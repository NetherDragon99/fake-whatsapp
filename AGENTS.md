# Project Engineering Rules

## Mandatory Release & Commit Workflow (Every Completed Task)

At the end of every task in this repository:

1. **Bump Patch Version (`x.x.old+1`)**:
   - Read the current version from `version.json` and increment the patch number (`x.x.<old + 1>`).
   - Update the version consistently across all four files:
     - `version.json` (`"version"` and `"cacheName": "wa-clone-v..."`)
     - `sw.js` (`APP_VERSION` and `CACHE_NAME`)
     - `js/app.js` (`window.APP_VERSION` and `window.APP_CACHE_NAME`)
     - `js/views/settings-view.js` (fallback strings `window.APP_VERSION || '...'`)
2. **Update Service Worker App Shell (`sw.js`)**:
   - Register every newly added `.js`, `.css`, or asset file required offline inside `APP_SHELL_FILES`.
3. **Verify Before Committing**:
   - Run `node --check` on every new or modified JS file.
   - Run the automated Node verification test suite and ensure 100% pass rate.
4. **Local Commit Only (No Push)**:
   - Stage changes and create a descriptive local `git commit`.
   - **Never** run `git push` unless the user explicitly asks to push.
