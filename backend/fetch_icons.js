const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Provider mapping to models.dev provider IDs
const PROVIDER_MAP = {
    'google': 'google',
    'openai': 'openai', 
    'anthropic': 'anthropic',
    'meta': 'meta',
    'deepseek': 'deepseek',
    'qwen': 'qwen'
};

const MODELS_DEV_BASE = 'https://models.dev/logos';
const ICONS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'icons');

async function fetchProviderIcon(provider) {
    try {
        console.log(`📥 Fetching ${provider} icon...`);
        const url = `${MODELS_DEV_BASE}/${provider}.svg`;
        const response = await axios.get(url, { responseType: 'text' });
        
        const iconPath = path.join(ICONS_DIR, `${provider}.svg`);
        fs.writeFileSync(iconPath, response.data);
        
        console.log(`✅ Saved ${provider} icon`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to fetch ${provider} icon:`, error.message);
        return false;
    }
}

async function createFallbackIcon(provider) {
    // Create a simple SVG fallback icon with the provider initial
    const initial = provider.charAt(0).toUpperCase();
    const colors = {
        'google': '#4285F4',
        'openai': '#00A67E', 
        'anthropic': '#D97757',
        'meta': '#1877F2',
        'deepseek': '#6366F1',
        'qwen': '#EF4444'
    };
    
    const color = colors[provider] || '#6B7280';
    const fallbackSVG = `
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="${color}"/>
  <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
    ${initial}
  </text>
</svg>`.trim();

    const iconPath = path.join(ICONS_DIR, `${provider}.svg`);
    fs.writeFileSync(iconPath, fallbackSVG);
    console.log(`🎨 Created fallback icon for ${provider}`);
}

async function fetchAllIcons() {
    console.log('🚀 Fetching provider icons from models.dev...');
    
    // Ensure icons directory exists
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }
    
    const providers = Object.values(PROVIDER_MAP);
    const results = {};
    
    for (const provider of providers) {
        const success = await fetchProviderIcon(provider);
        if (!success) {
            await createFallbackIcon(provider);
        }
        results[provider] = success;
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Create an index file for easy importing
    const indexContent = `// Auto-generated icon exports
${providers.map(provider => 
    `export { default as ${provider}Icon } from './${provider}.svg';`
).join('\n')}

export const providerIcons = {
${providers.map(provider => 
    `  ${provider}: require('./${provider}.svg')`
).join(',\n')}
};`;

    fs.writeFileSync(path.join(ICONS_DIR, 'index.js'), indexContent);
    
    console.log('\n📊 Icon fetch results:');
    Object.entries(results).forEach(([provider, success]) => {
        console.log(`  ${provider}: ${success ? '✅ Downloaded' : '🎨 Fallback created'}`);
    });
    
    console.log(`\n🎉 All icons ready in ${ICONS_DIR}`);
}

// Run the script
fetchAllIcons().catch(console.error);