/**
 * Equipment Manager - handles equipment slots and gear management
 */
export class EquipmentManager {
  constructor(templateManager, inventoryManager) {
    this.templateManager = templateManager
    this.inventoryManager = inventoryManager
    
    console.log('EquipmentManager initialized')
  }
}