const fs = require('fs');
const path = require('path');

// Get the API key from the command-line arguments
const apiKey = process.argv[2];
if (!apiKey) {
    throw new Error('Please provide an API key as a command-line argument.');
}

// Define the list of strings to check for
const uppercaseFolders = ['EORTC', 'HADS'];

// Load the JSON data
const data = require('../AYA_cancer_schema.json');

const variableInfo = data.variable_info;

async function getClassDetails(classShortcode, apiKey, retries = 10) {
    // Prevent unnecessary fetching of class details for classes that are known to not exist; to adapt in code re-use
    if (classShortcode.includes('TODO', 'strongaya')) {
        return {
            definition: 'No definition available',
            preferredName: 'No preferred name available'
        };
    }

    const fetch = (await import('node-fetch')).default;
    const url = `https://data.bioontology.org/search?q=${encodeURIComponent(classShortcode)}&apikey=${apiKey}`;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 429 && attempt < retries - 1) {
                    // Too Many Requests, wait and retry with exponential backoff
                    const retryAfter = response.headers.get('Retry-After') || Math.pow(2, attempt + 1);
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
    content += `The concept we in STRONG AYA refer to as "_${variable}_" is identifiable through shortcode *${variableData.class}*.\n`;

    if (classDetails.preferredName === 'No preferred name available' && classDetails.definition === 'No definition available') {
        content += `This shortcode is custom and does not appear in standard vocabularies.\n\n`;
    } else {
        content += `In standard vocabularies this shortcode refers to "*${classDetails.preferredName}*" and is defined as "*${classDetails.definition}*"\n\n`;
    }

    // Add value mapping information
    if (variableData.value_mapping) {
        content += `## ${variable} values\n`;
        const valueMapping = variableData.value_mapping.terms;
        const terms = Object.keys(valueMapping);
        const formattedTerms = terms.length > 1 ? terms.slice(0, -1).map(term => `"_${term}_"`).join(', ') + ' and ' + `"_${terms.slice(-1)}_"` : `"_${terms[0]}_"`;
        content += `In STRONG AYA, this concept is recorded as ${formattedTerms}.\n\n`;
        for (const term in valueMapping) {
            const termDetails = await getClassDetails(valueMapping[term].target_class, apiKey);
            content += `The value we in STRONG AYA refer to as "_${term.charAt(0) + term.slice(1)}_" `;
            content += `is identifiable through shortcode *${valueMapping[term].target_class}*.\n`;
            if (termDetails.preferredName === 'No preferred name available' && termDetails.definition === 'No definition available') {
                content += `This shortcode is custom and does not appear in standard vocabularies.\n\n`;
            } else {
                content += `In standard vocabularies this shortcode refers to "*${termDetails.preferredName}*" and is defined as "*${termDetails.definition}*"\n\n`;
            }
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
                let dirName = label;
                if (uppercaseFolders.some(str => dirName.includes(str))) {
                    dirName = dirName.toUpperCase();
                }
                const classDir = path.join(__dirname, 'content', 'AYA-cancer-data-schema', 'codebook', ...classLabels.slice(0, index).concat(dirName));

                // Create the directory if it does not exist
                if (!fs.existsSync(classDir)) {
                    fs.mkdirSync(classDir, {recursive: true});
                }

                // Fetch the class details
                const classDetails = await getClassDetails(reconstruction.class, apiKey);

                // Create the _index.md file in the directory
                let indexContent = `---\nbookCollapseSection: true\nweight: 20\n---\n# ${label}\n The concept we in STRONG AYA refer to as "_${label}_" is identifiable through shortcode *${reconstruction.class}*\n and is used to cluster various concepts which are an attribute of _${label}_. `;
                if (classDetails.preferredName === 'No preferred name available' && classDetails.definition === 'No definition available') {
                    indexContent += `This shortcode is custom and does not appear in standard vocabularies.\n`;
                } else {
                    indexContent += `In standard vocabularies this shortcode refers to "*${classDetails.preferredName}*" and is defined as "*${classDetails.definition}*"\n`;
                }
                fs.writeFileSync(path.join(classDir, '_index.md'), indexContent);

                classDirs.push(classDir);
            }
        }
    }

    // Add node type information to the content
    await Promise.all(schemaReconstruction.map(async (reconstruction) => {
        if (reconstruction.type === 'node') {
            content += `## ${variable} unit\n\n`;
            content += `In STRONG AYA, "_${variable}_" is recorded in "*${reconstruction.aesthetic_label}*" and this is associated with shortcode *${reconstruction.class}*.\n`;

            // Fetch the class details
            const nodeClassDetails = await getClassDetails(reconstruction.class, apiKey);

            if (nodeClassDetails.preferredName === 'No preferred name available' && nodeClassDetails.definition === 'No definition available') {
                content += `This shortcode is custom and does not appear in standard vocabularies.\n\n`;
            } else {
                content += `In standard vocabularies this shortcode refers to "*${nodeClassDetails.preferredName}*" and is defined as "*${nodeClassDetails.definition}*"\n\n`;
            }
        }
    }));

    // Write the variable's info to a Markdown file in the last class directory
    if (classDirs.length > 0) {
        const lastClassDir = classDirs[classDirs.length - 1];
        const variableFilePath = path.join(lastClassDir, `${variable}.md`);
        fs.writeFileSync(variableFilePath, content);
    }
});