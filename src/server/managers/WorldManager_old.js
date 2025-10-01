/**
 * World Manager - handles world state, rooms, NPCs, and template loading
 */
export class WorldManager {
  constructor() {
    this.templateManager = new TemplateManager()
    
    console.log('WorldManager initialized')
  }
}

/**
 * Template Manager - loads and manages game templates (items, NPCs, etc.)
 */
class TemplateManager {
  constructor() {
    console.log('TemplateManager initialized')
  }
}