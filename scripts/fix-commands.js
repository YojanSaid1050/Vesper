const fs = require('fs');
const path = require('path');

const COMMANDS_PATH = path.join(__dirname, '..', 'src', 'commands');

// Lista exacta de comandos que necesitan refresh (16 comandos)
const commandsToFix = [
    // TikTok (4)
    { file: 'tiktok/add.js', panel: 'tiktok' },
    { file: 'tiktok/remove.js', panel: 'tiktok' },
    { file: 'tiktok/clear.js', panel: 'tiktok' },
    { file: 'tiktok/setchannel.js', panel: 'tiktok' },
    
    // Twitch (4)
    { file: 'twitch/add.js', panel: 'twitch' },
    { file: 'twitch/remove.js', panel: 'twitch' },
    { file: 'twitch/clear.js', panel: 'twitch' },
    { file: 'twitch/setchannel.js', panel: 'twitch' },
    
    // YouTube (4)
    { file: 'youtube/add.js', panel: 'youtube' },
    { file: 'youtube/remove.js', panel: 'youtube' },
    { file: 'youtube/clear.js', panel: 'youtube' },
    { file: 'youtube/setchannel.js', panel: 'youtube' },
    
    // Admin (4)
    { file: 'admin/resetbranding.js', panel: 'branding' },
    { file: 'admin/setbotname.js', panel: 'branding' },
    { file: 'admin/setbotavatar.js', panel: 'branding' },
    { file: 'admin/setbotrole.js', panel: 'general' }
];

// Función para añadir el refresh de manera segura
function addRefreshToCommand(content, panelType) {
    // Verificar si ya tiene el refresh
    if (content.includes('updateDashboard') && content.includes('getActivePanel')) {
        return { changed: false, content: content };
    }
    
    let newContent = content;
    
    // Añadir importación si no existe
    if (!content.includes('dashboard/updater')) {
        const importLine = `const { updateDashboard, getActivePanel } = require('../../dashboard/updater');\n`;
        
        // Encontrar el último require
        const lines = content.split('\n');
        let lastRequireIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(')) {
                lastRequireIndex = i;
            }
        }
        
        if (lastRequireIndex !== -1) {
            lines.splice(lastRequireIndex + 1, 0, importLine.trim());
            newContent = lines.join('\n');
        } else {
            newContent = importLine + newContent;
        }
    }
    
    // Código de refresh (sin espacios extra)
    const refreshCode = `\n    \n    // Refrescar dashboard automáticamente\n    const activePanel = await getActivePanel(interaction.guildId);\n    await updateDashboard(interaction.client, interaction.guildId, activePanel.type, activePanel.mode);\n`;
    
    // Encontrar el final del execute (último } antes del module.exports)
    const executeMatch = newContent.match(/async execute\([^)]*\)\s*{([\s\S]*?)}\s*(?=\n\s*}\s*;?\s*$|\n\s*module\.exports)/);
    
    if (executeMatch) {
        const executeBody = executeMatch[1];
        const lines = executeBody.split('\n');
        
        // Buscar la última línea que no sea vacía
        let lastNonEmptyLine = lines.length - 1;
        while (lastNonEmptyLine >= 0 && lines[lastNonEmptyLine].trim() === '') {
            lastNonEmptyLine--;
        }
        
        // Insertar refresh antes de la última línea
        if (lastNonEmptyLine >= 0) {
            lines.splice(lastNonEmptyLine + 1, 0, refreshCode.trim());
            const newExecuteBody = lines.join('\n');
            newContent = newContent.replace(executeMatch[1], newExecuteBody);
            return { changed: true, content: newContent };
        }
    }
    
    return { changed: false, content: newContent };
}

// Función principal
async function main() {
    console.log('🔧 CORRECTOR AUTOMÁTICO DE COMANDOS\n');
    console.log('═'.repeat(50));
    
    let fixed = 0;
    let skipped = 0;
    let notFound = 0;
    
    for (const cmd of commandsToFix) {
        const filePath = path.join(COMMANDS_PATH, cmd.file);
        const fileName = path.basename(cmd.file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ No encontrado: ${cmd.file}`);
            notFound++;
            continue;
        }
        
        console.log(`📝 Procesando: ${cmd.file}`);
        
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const { changed, content: newContent } = addRefreshToCommand(content, cmd.panel);
            
            if (changed) {
                // Crear backup si no existe
                const backupPath = filePath + '.bak';
                if (!fs.existsSync(backupPath)) {
                    fs.writeFileSync(backupPath, content, 'utf8');
                    console.log(`   💾 Backup creado: ${fileName}.bak`);
                }
                
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`   ✅ Actualizado: ${fileName}`);
                fixed++;
            } else {
                console.log(`   ⏭️ Saltado: ${fileName} (ya tiene refresh)`);
                skipped++;
            }
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
        console.log('');
    }
    
    console.log('═'.repeat(50));
    console.log(`\n✨ RESUMEN:`);
    console.log(`   ✅ Comandos actualizados: ${fixed}`);
    console.log(`   ⏭️ Comandos saltados: ${skipped}`);
    console.log(`   ❌ No encontrados: ${notFound}`);
    console.log(`   📋 Total procesados: ${commandsToFix.length}`);
    
    if (fixed > 0) {
        console.log(`\n💡 Los backups se guardaron con extensión .bak`);
        console.log(`   Para restaurar: for /r src\\commands %f in (*.bak) do copy \"%f\" \"%~nf\"`);
    }
}

// Ejecutar
main().catch(console.error);