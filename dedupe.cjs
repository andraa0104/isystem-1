const fs = require('fs');
const { execSync } = require('child_process');

const frontendFiles = execSync('find resources/js/pages -name "*.jsx"').toString().split('\n').filter(Boolean);

frontendFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We can just use a regex to consolidate multiple identical onFinish lines
    // Match one or more 'onFinish: () => setIsSubmitting(false),'
    content = content.replace(/(onFinish:\s*\(\)\s*=>\s*setIsSubmitting\(false\),\s*)+/g, 'onFinish: () => setIsSubmitting(false),\n');
    content = content.replace(/(onFinish:\s*\(\)\s*=>\s*setIsSaving\(false\),\s*)+/g, 'onFinish: () => setIsSaving(false),\n');

    if (content !== original) {
        fs.writeFileSync(file, content);
    }
});
