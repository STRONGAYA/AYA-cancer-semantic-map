const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

// Get the API key from the command-line arguments
const apiKey = process.argv[2];
if (!apiKey) {
    throw new Error('Please provide an API key as a command-line argument.');
}

// Define the list of strings to check for
const uppercaseFolders = ['EORTC', 'HADS'];

// Load the JSON-LD data
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'AYA_cancer_schema.jsonld'), 'utf8'));

const variableInfo = data.schema.variables;

// Initialize the base semantic mapping directory and content
const baseDir = path.join(__dirname, 'content', 'AYA-cancer-data-semantic-map', 'Semantic Mapping');
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, {recursive: true});

    // Copy the existing _index.md content
    const sourceIndexPath = path.join(__dirname, 'content', 'AYA-cancer-data-semantic-map', '_index.md');
    if (fs.existsSync(sourceIndexPath)) {
        const indexContent = fs.readFileSync(sourceIndexPath, 'utf8');
        fs.writeFileSync(path.join(baseDir, '_index.md'), indexContent);
    }
}

async function getClassDetails(classShortcode, apiKey, retries = 10) {
    // Prevent unnecessary fetching of class details for classes that are known to not exist
    const skipShortcodes = ['TODO', 'strongaya'];
    if (skipShortcodes.some(code => classShortcode.includes(code))) {
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
                const classDetails = data.collection[0];
                return {
                    definition: classDetails.definition ? classDetails.definition[0] : 'No definition available',
                    preferredName: classDetails.prefLabel || 'No preferred name available'
                };
            } else {
                console.warn(`::warning:: Whilst trying to fetch class details, the shortcode **${classShortcode}** couldn't be found.`);
                return {
                    definition: 'No definition available',
                    preferredName: 'No preferred name available'
                };
            }
        } catch (error) {
            if (attempt === retries - 1) {
                console.error(error);
                console.warn(`::warning:: Error fetching class details for shortcode **${classShortcode}**: ${error.message}`);
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
    content += `The concept we in STRONG AYA refer to as "_${variable}_" is identifiable through shortcode *${variableData.class}*.  \n`;

    if (classDetails.preferredName === 'No preferred name available' && classDetails.definition === 'No definition available') {
        content += `This shortcode is custom and does not appear in standard vocabularies.\n\n`;
    } else {
        content += `In standard vocabularies this shortcode refers to "*${classDetails.preferredName}*" and is defined as "*${classDetails.definition}*"\n\n`;
    }

    // Add value mapping information
    if (variableData.valueMapping) {
        content += `## ${variable} values\n`;
        const valueMapping = variableData.valueMapping.terms;
        const terms = Object.keys(valueMapping);
        const formattedTerms = terms.length > 1 ? terms.slice(0, -1).map(term => `"_${term}_"`).join(', ') + ' and ' + `"_${terms.slice(-1)}_"` : `"_${terms[0]}_"`;
        content += `In STRONG AYA, this concept is recorded as ${formattedTerms}.\n\n`;
        for (const term in valueMapping) {
            const termDetails = await getClassDetails(valueMapping[term].targetClass, apiKey);
            content += `The value we in STRONG AYA refer to as "_${term.charAt(0) + term.slice(1)}_" `;
            content += `is identifiable through shortcode *${valueMapping[term].targetClass}*.  \n`;
            if (termDetails.preferredName === 'No preferred name available' && termDetails.definition === 'No definition available') {
                content += `This shortcode is custom and does not appear in standard vocabularies.\n\n`;
            } else {
                content += `In standard vocabularies this shortcode refers to "*${termDetails.preferredName}*" and is defined as "*${termDetails.definition}*"\n\n`;
            }
        }
    }

    // Process schemaReconstruction field
    const schemaReconstruction = variableData.schemaReconstruction || [];
    let classDirs = [];

    // Filter ClassNodes without placement once, then process directory chain
    const classNodes = schemaReconstruction.filter(rec => rec['@type'] === 'schema:ClassNode' && !rec.placement);
    const classLabels = classNodes.map(rec => rec.aestheticLabel);

    for (const [index, classNode] of classNodes.entries()) {
        const label = classNode.aestheticLabel;
        let dirName = label;
        if (uppercaseFolders.some(str => dirName.includes(str))) {
            dirName = dirName.toUpperCase();
        }
        const classDir = path.join(__dirname, 'content', 'AYA-cancer-data-semantic-map', 'Semantic Mapping', ...classLabels.slice(0, index).concat(dirName));

        // Create the directory if it does not exist
        if (!fs.existsSync(classDir)) {
            fs.mkdirSync(classDir, {recursive: true});
        }

        // Fetch the class details
        const classDetails = await getClassDetails(classNode.class, apiKey);

        let indexContent = `---\nbookCollapseSection: true\nweight: 20\n---\n# ${label}\n The concept we in STRONG AYA refer to as "_${label}_" is identifiable through shortcode *${classNode.class}*.  \n`;
        if (classDetails.preferredName === 'No preferred name available' && classDetails.definition === 'No definition available') {
            indexContent += `This shortcode is custom and does not appear in standard vocabularies.\n`;
        } else {
            indexContent += `In standard vocabularies this shortcode refers to "*${classDetails.preferredName}*" and is defined as "*${classDetails.definition}*"\n`;
        }
        fs.writeFileSync(path.join(classDir, '_index.md'), indexContent);

        classDirs.push(classDir);
    }

    // Add node type information to the content
    await Promise.all(schemaReconstruction.map(async (reconstruction) => {
        if (reconstruction['@type'] === 'schema:UnitNode') {
            content += `## ${variable} unit\n\n`;
            content += `In STRONG AYA, "_${variable}_" is recorded in "*${reconstruction.aestheticLabel}*" and this is associated with shortcode *${reconstruction.class}*.  \n`;

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