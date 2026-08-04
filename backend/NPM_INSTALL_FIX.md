# Windows npm installation fix

The original package lock accidentally contained five internal build-environment tarball URLs. They have been replaced with official `registry.npmjs.org` URLs in this fixed package.

## Recommended

Double-click:

`FIX_NPM_INSTALL_WINDOWS.bat`

Or run manually in Command Prompt as Administrator:

```bat
taskkill /F /IM node.exe
rmdir /S /Q node_modules
npm config set registry https://registry.npmjs.org/
npm cache verify
npm install --registry=https://registry.npmjs.org/
```

If `rmdir` says access is denied, close VS Code, File Explorer windows opened inside `node_modules`, and any running Node server. Restart Windows if necessary.
