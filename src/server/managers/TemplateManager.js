/**
 * Template Manager - loads and manages game templates
 * Provides clean interface for template data access
 */
import fs from 'fs';
import path from 'path';

export class TemplateManager {
    constructor() {
        this.items = new Map(); // itemId -> item template
        this.npcs = new Map(); // npcId -> npc template
        this.quests = new Map(); // questId -> quest template
        this.enemies = new Map(); // enemyId -> enemy template
        
        this.loadTemplates();
        console.log('TemplateManager initialized');
    }

    /**
     * Load all templates from files
     */
    loadTemplates() {
        try {
            this.loadItems();
            this.loadNPCs();
            this.loadQuests();
            this.loadEnemies();
            
            console.log(`Loaded templates: ${this.items.size} items, ${this.npcs.size} NPCs, ${this.quests.size} quests, ${this.enemies.size} enemies`);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    /**
     * Load item templates
     */
    loadItems() {
        const itemsDir = 'templates/items';
        if (!fs.existsSync(itemsDir)) return;
        
        const itemFiles = fs.readdirSync(itemsDir).filter(file => file.endsWith('.json'));
        
        for (const itemFile of itemFiles) {
            try {
                const itemId = path.basename(itemFile, '.json');
                const itemPath = path.join(itemsDir, itemFile);
                const itemData = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
                
                this.items.set(itemId, {
                    ...itemData,
                    id: itemId
                });
            } catch (error) {
                console.error(`Error loading item ${itemFile}:`, error);
            }
        }
    }

    /**
     * Load NPC templates
     */
    loadNPCs() {
        const npcsDir = 'templates/npcs';
        if (!fs.existsSync(npcsDir)) return;
        
        const npcFiles = fs.readdirSync(npcsDir).filter(file => file.endsWith('.json'));
        
        for (const npcFile of npcFiles) {
            try {
                const npcId = path.basename(npcFile, '.json');
                const npcPath = path.join(npcsDir, npcFile);
                const npcData = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
                
                this.npcs.set(npcId, {
                    ...npcData,
                    id: npcId
                });
            } catch (error) {
                console.error(`Error loading NPC ${npcFile}:`, error);
            }
        }
    }

    /**
     * Load quest templates
     */
    loadQuests() {
        const questsDir = 'templates/quests';
        if (!fs.existsSync(questsDir)) return;
        
        const questFiles = fs.readdirSync(questsDir).filter(file => file.endsWith('.json'));
        
        for (const questFile of questFiles) {
            try {
                const questId = path.basename(questFile, '.json');
                const questPath = path.join(questsDir, questFile);
                const questData = JSON.parse(fs.readFileSync(questPath, 'utf8'));
                
                this.quests.set(questId, {
                    ...questData,
                    id: questId
                });
            } catch (error) {
                console.error(`Error loading quest ${questFile}:`, error);
            }
        }
    }

    /**
     * Load enemy templates
     */
    loadEnemies() {
        const enemiesDir = 'templates/enemies';
        if (!fs.existsSync(enemiesDir)) return;
        
        const enemyFiles = fs.readdirSync(enemiesDir).filter(file => file.endsWith('.json'));
        
        for (const enemyFile of enemyFiles) {
            try {
                const enemyId = path.basename(enemyFile, '.json');
                const enemyPath = path.join(enemiesDir, enemyFile);
                const enemyData = JSON.parse(fs.readFileSync(enemyPath, 'utf8'));
                
                this.enemies.set(enemyId, {
                    ...enemyData,
                    id: enemyId
                });
            } catch (error) {
                console.error(`Error loading enemy ${enemyFile}:`, error);
            }
        }
    }

    /**
     * Get item template
     * @param {string} itemId - Item ID
     * @returns {Object|null} Item template
     */
    getItem(itemId) {
        return this.items.get(itemId) || null;
    }

    /**
     * Get NPC template
     * @param {string} npcId - NPC ID
     * @returns {Object|null} NPC template
     */
    getNPC(npcId) {
        return this.npcs.get(npcId) || null;
    }

    /**
     * Get quest template
     * @param {string} questId - Quest ID
     * @returns {Object|null} Quest template
     */
    getQuest(questId) {
        return this.quests.get(questId) || null;
    }

    /**
     * Get enemy template
     * @param {string} enemyId - Enemy ID
     * @returns {Object|null} Enemy template
     */
    getEnemy(enemyId) {
        return this.enemies.get(enemyId) || null;
    }

    /**
     * Get all items
     * @returns {Map} All item templates
     */
    getAllItems() {
        return this.items;
    }

    /**
     * Get all NPCs
     * @returns {Map} All NPC templates
     */
    getAllNPCs() {
        return this.npcs;
    }

    /**
     * Get all quests
     * @returns {Map} All quest templates
     */
    getAllQuests() {
        return this.quests;
    }

    /**
     * Get all enemies
     * @returns {Map} All enemy templates
     */
    getAllEnemies() {
        return this.enemies;
    }

    /**
     * Search items by name or description
     * @param {string} searchTerm - Search term
     * @returns {Array} Matching items
     */
    searchItems(searchTerm) {
        const results = [];
        const term = searchTerm.toLowerCase();
        
        for (const [itemId, item] of this.items) {
            if (item.name?.toLowerCase().includes(term) || 
                item.description?.toLowerCase().includes(term)) {
                results.push(item);
            }
        }
        
        return results;
    }

    /**
     * Get items by category
     * @param {string} category - Item category
     * @returns {Array} Items in category
     */
    getItemsByCategory(category) {
        const results = [];
        
        for (const [itemId, item] of this.items) {
            if (item.category === category) {
                results.push(item);
            }
        }
        
        return results;
    }

    /**
     * Get template statistics
     * @returns {Object} Template statistics
     */
    getStats() {
        return {
            items: this.items.size,
            npcs: this.npcs.size,
            quests: this.quests.size,
            enemies: this.enemies.size,
            categories: {
                weapons: this.getItemsByCategory('weapon').length,
                armor: this.getItemsByCategory('armor').length,
                consumables: this.getItemsByCategory('consumable').length,
                misc: this.getItemsByCategory('misc').length
            }
        };
    }

    /**
     * Reload templates from disk
     */
    reload() {
        this.items.clear();
        this.npcs.clear();
        this.quests.clear();
        this.enemies.clear();
        
        this.loadTemplates();
        console.log('Templates reloaded');
    }

    /**
     * Validate template data
     * @returns {Array} Array of validation errors
     */
    validate() {
        const errors = [];
        
        // Validate items
        for (const [itemId, item] of this.items) {
            if (!item.name) {
                errors.push(`Item ${itemId} missing name`);
            }
            if (!item.description) {
                errors.push(`Item ${itemId} missing description`);
            }
        }
        
        // Validate NPCs
        for (const [npcId, npc] of this.npcs) {
            if (!npc.name) {
                errors.push(`NPC ${npcId} missing name`);
            }
            if (!npc.description) {
                errors.push(`NPC ${npcId} missing description`);
            }
        }
        
        return errors;
    }
}