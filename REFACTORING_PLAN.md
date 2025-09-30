# Mudden Refactoring Plan

## Overview
The Mudden codebase has grown to **6,538 lines** with some files becoming overly complex while maintaining excellent game features. This plan focuses on **reducing code complexity without removing features** - keeping all the gameplay elements that make Mudden fun while making the code more maintainable.

## Current Complexity Issues

| File | Lines | Problem | Target |
|------|-------|---------|--------|
| server.js | 1,019 | Too many responsibilities | ~200 |
| CombatManager.js | 631 | Over-complex state management | ~300 |
| InfoCommands.js | 452 | Giant 'look' command does everything | ~200 |
| QuestCommands.js | 528 | Over-engineered quest inspection | ~250 |
| **Total** | **2,630** | **Major complexity sources** | **~950** |

**Potential Reduction: ~1,680 lines** while keeping all features!

## Features We're Keeping
✅ **Multiple enemy attacks** (varied combat messages)  
✅ **Unpredictable loot** (makes collecting more fun)  
✅ **Friends system with notes** (simple and social)  
✅ **Multi-slot equipment** (progression motivation)  
✅ **Quest system** (content and goals)  
✅ **Shared combat** (social gameplay)  
✅ **Real-time updates** (modern feel)  

## Refactoring Phases

### Phase 1: Extract Server Logic 🔴 **Not Started**
**Goal: Reduce server.js from 1,019 to ~200 lines**

#### Tasks:
- [ ] Create `lib/AuthenticationManager.js`
  - [ ] Move login validation logic
  - [ ] Move character creation logic
  - [ ] Move password checking
  - [ ] Target: ~150 lines

- [ ] Create `lib/SocketManager.js`
  - [ ] Move socket event handlers
  - [ ] Move connection management
  - [ ] Move disconnect handling
  - [ ] Target: ~200 lines

- [ ] Create `lib/SessionManager.js`
  - [ ] Move active player tracking
  - [ ] Move duplicate login prevention
  - [ ] Move session state management
  - [ ] Target: ~100 lines

- [ ] Refactor `server.js`
  - [ ] Keep only setup and initialization
  - [ ] Delegate to managers
  - [ ] Clean imports and exports
  - [ ] Target: ~200 lines

**Estimated Impact: -600 lines**

### Phase 2: Simplify Combat System 🔴 **Not Started**
**Goal: Reduce CombatManager.js from 631 to ~300 lines**

#### Current Problems:
- Complex session mapping (`combatSessions` + `playerToSession`)
- Over-detailed state tracking
- Tight coupling with game ticks

#### Tasks:
- [ ] Simplify combat state model
  - [ ] Replace complex mapping with simple `player.combatWith = enemy`
  - [ ] Remove redundant session tracking
  - [ ] Keep multiple attacks feature

- [ ] Streamline combat flow
  - [ ] Simplify turn processing
  - [ ] Reduce state management overhead
  - [ ] Keep varied attack messages

- [ ] Optimize game tick integration
  - [ ] Reduce coupling between combat and ticks
  - [ ] Keep real-time combat updates

**Estimated Impact: -330 lines**

### Phase 3: Break Up InfoCommands 🔴 **Not Started**
**Goal: Reduce InfoCommands.js from 452 to ~200 lines**

#### Current Problems:
- Giant `look()` method handles everything
- Mixed responsibilities (rooms, items, players, equipment)
- Hard to maintain and extend

#### Tasks:
- [ ] Split `look()` command into focused methods:
  - [ ] `lookRoom()` - room descriptions and contents
  - [ ] `lookItem()` - item examination
  - [ ] `lookPlayer()` - player inspection
  - [ ] `lookEquipment()` - equipment details

- [ ] Create formatting utilities
  - [ ] Extract common formatting logic
  - [ ] Create reusable display functions
  - [ ] Keep all current information display

- [ ] Organize command structure
  - [ ] Group related functionality
  - [ ] Improve code readability

**Estimated Impact: -250 lines**

### Phase 4: Streamline Quest System 🔴 **Not Started**
**Goal: Reduce QuestCommands.js from 528 to ~250 lines**

#### Current Problems:
- Over-complex quest reward inspection
- Detailed progress tracking with many edge cases
- Too much quest state management

#### Tasks:
- [ ] Simplify quest progress tracking
  - [ ] Reduce complex objective handling
  - [ ] Keep quest completion mechanics
  - [ ] Maintain quest variety

- [ ] Streamline reward system
  - [ ] Keep quest rewards functional
  - [ ] Simplify reward inspection code
  - [ ] Maintain reward variety

- [ ] Optimize quest state management
  - [ ] Reduce unnecessary state tracking
  - [ ] Keep active/completed quest lists
  - [ ] Maintain quest persistence

**Estimated Impact: -280 lines**

## Additional Optimizations (Future)

### Phase 5: Minor Cleanups 🔴 **Not Started**
- [ ] `client.js` (867 lines) - Extract UI managers
- [ ] `Player.js` (468 lines) - Split player actions from data
- [ ] `SocialCommands.js` (385 lines) - Simplify message handling
- [ ] `TemplateManager.js` (358 lines) - Optimize loading logic

## Success Metrics

### Code Quality
- [ ] **Total lines reduced by ~2,000** (from 6,538 to ~4,500)
- [ ] **No file over 400 lines**
- [ ] **Better separation of concerns**
- [ ] **Improved maintainability**

### Feature Preservation
- [ ] **All combat features working** (multiple attacks, shared combat)
- [ ] **All social features working** (friends, tell/say, channels)
- [ ] **All progression working** (levels, equipment, quests)
- [ ] **All UI features working** (real-time updates, maps)

### Performance
- [ ] **Same or better performance**
- [ ] **No new bugs introduced**
- [ ] **Easier to add new features**

## Implementation Notes

### Principles
1. **Keep it Simple** - Don't over-engineer the refactoring
2. **Feature Preservation** - Every current feature must still work
3. **Test as We Go** - Verify functionality after each phase
4. **Incremental Changes** - Small, focused commits

### Testing Strategy
- Test all major features after each phase
- Verify no regressions in gameplay
- Check performance hasn't degraded
- Ensure all socket events still work

### Rollback Plan
- Git branches for each phase
- Can revert individual phases if needed
- Keep current version as backup branch

## Getting Started

**Recommended Starting Point: Phase 1 (Server Logic)**
- Biggest immediate impact
- Makes other phases easier
- Improves overall architecture

**Next Steps:**
1. Create feature branch for Phase 1
2. Implement AuthenticationManager.js
3. Test login/creation functionality
4. Continue with SocketManager.js
5. Verify all functionality before merging

---

*This refactoring focuses on **reducing complexity, not features**. The goal is a cleaner, more maintainable codebase that preserves everything players love about Mudden.*