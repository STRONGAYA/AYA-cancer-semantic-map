const fs = require('fs');
const path = require('path');

// Get the API key from the command-line arguments
const apiKey = process.argv[2];
if (!apiKey) {
    throw new Error('Please provide an API key as a command-line argument.');
}

// Load the JSON data
const data = require('../AYA_cancer_schema.json');

const variableInfo = data.variable_info;

async function getClassDetails(classShortcode, apiKey, retries = 3) {
    const fetch = (await import('node-fetch')).default;
    const url = `https://data.bioontology.org/search?q=${encodeURIComponent(classShortcode)}&apikey=${apiKey}`;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 429 && attempt < retries - 1) {
                    // Too Many Requests, wait and retry
                    const retryAfter = response.headers.get('Retry-After') || 1;
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                }
                throw new Error(`Error fetching class details: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.collection && data.collection.length > 0) {
                const classDetails = data.collection[0]; // Assuming the first result is the correct one
                return {
                    definition: classDetails.definition ? classDetails.definition[0] : 'No definition available',
                    preferredName: classDetails.prefLabel || 'No preferred name available'
                };
            } else {
                return {
                    definition: 'No definition available',
                    preferredName: 'No preferred name available'
                };
            }
        } catch (error) {
            if (attempt === retries - 1) {
                console.error(error);
                return {
                    definition: 'Error fetching definition',
                    preferredName: 'Error fetching preferred name'
                };
            }
        }
    }
}

// Generate Markdown content for each variable
Object.keys(variableInfo).forEach(async (variable) => {
    let content = `---\ntitle: "${variable}"\n---\n# ${variable}\n`;

    const variableData = variableInfo[variable];

    // Fetch the class details
    const classDetails = await getClassDetails(variableData.class, apiKey);
    content += `## Vocabulary information:\n\n`;
    content += `    - Class shortcode: ${variableData.class}\n`;
    content += `    - Preferred name: ${classDetails.preferredName}\n`;
    content += `    - Definition**: ${classDetails.definition}\n\n`;

    // Add value mapping information
    if (variableData.value_mapping) {
        const valueMapping = variableData.value_mapping.terms;
        content += `## Allowed values**:\n`;
        for (const term in valueMapping) {
            const termDetails = await getClassDetails(valueMapping[term].target_class, apiKey);
            content += `  - ${term.charAt(0).toUpperCase() + term.slice(1)}\n`;
            content += `    - Class: ${valueMapping[term].target_class}\n`;
            content += `    - Preferred name: ${termDetails.preferredName}\n`;
            content += `    - Definition: ${termDetails.definition}\n`;
        }
    }

    // Process schema_reconstruction field
    const schemaReconstruction = variableData.schema_reconstruction || [];
    let classDirs = [];

    for (const reconstruction of schemaReconstruction) {
        if (reconstruction.type === 'class') {
            const classLabels = schemaReconstruction
                .filter(rec => rec.type === 'class')
                .map(rec => rec.aesthetic_label);

            for (const [index, label] of classLabels.entries()) {
                const classDir = path.join(__dirname, 'content', 'AYA-cancer-data-schema', 'codebook', ...classLabels.slice(0, index + 1));

                // Create the directory if it does not exist
                if (!fs.existsSync(classDir)) {
                    fs.mkdirSync(classDir, {recursive: true});
                }

                // Fetch the class details
                const classDetails = await getClassDetails(reconstruction.class, apiKey);

                // Create the _index.md file in the directory
                const indexContent = `---\nbookCollapseSection: true\nweight: 20\n---\n# ${label}\nClass shortcode: ${reconstruction.class}\nPreferred name: ${classDetails.preferredName}\nDefinition: ${classDetails.definition}\n`;
                fs.writeFileSync(path.join(classDir, '_index.md'), indexContent);

                classDirs.push(classDir);
            }
        }
    }

    // Add node type information to the content
    schemaReconstruction.forEach(reconstruction => {
        if (reconstruction.type === 'node') {
            content += `## Special annotations\n`;
            content += `**Node aesthetic label**: ${reconstruction.aesthetic_label}\n`;
            content += `**Node predicate**: ${reconstruction.predicate}\n`;
        }
    });

    // Write the variable's info to a Markdown file in the last class directory
    if (classDirs.length > 0) {
        const lastClassDir = classDirs[classDirs.length - 1];
        const variableFilePath = path.join(lastClassDir, `${variable}.md`);
        fs.writeFileSync(variableFilePath, content);
    }
});