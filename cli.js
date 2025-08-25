#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
var index_js_1 = require("./cli/index.js");
var atomicProcessor_js_1 = require("./cli/processors/atomicProcessor.js");
var init_js_1 = require("./cli/commands/init.js");
var frameworks_js_1 = require("./cli/commands/frameworks.js");
var path = require("path");
// CLI setup
commander_1.program
    .name('lula')
    .description('Lula - Git-friendly compliance control management')
    .version('1.0.0');
// Init command - interactive project setup
commander_1.program
    .command('init')
    .description('Create a new compliance project with guided setup')
    .option('--framework <id>', 'Framework ID (skip interactive selection)')
    .option('--with-cci [value]', 'Enable CCI tracking (true/false)')
    .option('--project-name <name>', 'Project name')
    .option('--directory <dir>', 'Project directory')
    .option('--non-interactive', 'Skip interactive prompts')
    .action(function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var initCommand;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                initCommand = new init_js_1.InitCommand();
                return [4 /*yield*/, initCommand.run({
                        framework: options.framework,
                        withCci: options.withCci !== undefined ? (options.withCci === true || options.withCci === 'true') : undefined,
                        projectName: options.projectName,
                        directory: options.directory,
                        interactive: !options.nonInteractive
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
// Frameworks command - list available frameworks
commander_1.program
    .command('frameworks')
    .description('List available compliance frameworks')
    .option('-v, --verbose', 'Show detailed information and usage examples')
    .action(function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var frameworksCommand;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                frameworksCommand = new frameworks_js_1.FrameworksCommand();
                return [4 /*yield*/, frameworksCommand.run({ verbose: options.verbose })];
            case 1:
                _a.sent();
                if (options.verbose) {
                    frameworksCommand.getRecommendations();
                }
                return [2 /*return*/];
        }
    });
}); });
// Serve command - start the web server
commander_1.program
    .command('serve')
    .description('Start the web server')
    .option('--dir <directory>', 'Control set directory path', './examples/nist-800-53-rev4')
    .option('--port <port>', 'Server port', '3000')
    .action(function (options) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, index_js_1.startServer)(options.dir, parseInt(options.port))];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
// Import command - import controls from OSCAL files
commander_1.program
    .command('import')
    .description('Import controls from OSCAL catalog or profile files')
    .argument('<source>', 'Path to OSCAL file or URL')
    .argument('<output-dir>', 'Output directory for controls')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--dry-run', 'Show what would be processed without writing files', false)
    .option('--preserve-oscal', 'Preserve original OSCAL references and parameter insertions', false)
    .action(function (source, outputDir, options) { return __awaiter(void 0, void 0, void 0, function () {
    var atomicOptions, processor, tempFilePath, sourceFilePath, response, fileContent, fs, os, result, fs, e_1, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 15, , 16]);
                console.log('🔄 Starting OSCAL import...');
                console.log("\uD83D\uDCE5 Source: ".concat(source));
                console.log("\uD83D\uDCE4 Output: ".concat(outputDir));
                atomicOptions = {
                    use_cci: true, // Use CCI by default for NIST frameworks
                    output_dir: outputDir,
                    overwrite: options.overwrite,
                    dry_run: options.dryRun,
                    flatten_references: !options.preserveOscal,
                    include_links: options.preserveOscal,
                    resolve_parameters: !options.preserveOscal,
                    nist_revision_filter: '4' // Filter to Rev 4 only
                };
                processor = new atomicProcessor_js_1.AtomicProcessor();
                tempFilePath = void 0;
                sourceFilePath = source;
                if (!(source.startsWith('http://') || source.startsWith('https://'))) return [3 /*break*/, 6];
                console.log("\uD83D\uDCE5 Fetching OSCAL file from ".concat(source, "..."));
                return [4 /*yield*/, fetch(source)];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Failed to fetch ".concat(source, ": ").concat(response.status, " ").concat(response.statusText));
                }
                return [4 /*yield*/, response.text()];
            case 2:
                fileContent = _a.sent();
                return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
            case 3:
                fs = _a.sent();
                return [4 /*yield*/, Promise.resolve().then(function () { return require('os'); })];
            case 4:
                os = _a.sent();
                tempFilePath = path.join(os.tmpdir(), "oscal-import-".concat(Date.now(), ".json"));
                return [4 /*yield*/, fs.promises.writeFile(tempFilePath, fileContent, 'utf8')];
            case 5:
                _a.sent();
                sourceFilePath = tempFilePath;
                _a.label = 6;
            case 6:
                _a.trys.push([6, , 8, 14]);
                return [4 /*yield*/, processor.processOSCAL(sourceFilePath, atomicOptions)];
            case 7:
                result = _a.sent();
                console.log('✅ OSCAL import completed successfully');
                console.log("\uD83D\uDCCA Framework: ".concat(result.framework.name, " (").concat(result.framework.version, ")"));
                console.log("\uD83D\uDCCA Controls: ".concat(result.controls.length));
                return [3 /*break*/, 14];
            case 8:
                if (!tempFilePath) return [3 /*break*/, 13];
                _a.label = 9;
            case 9:
                _a.trys.push([9, 12, , 13]);
                return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
            case 10:
                fs = _a.sent();
                return [4 /*yield*/, fs.promises.unlink(tempFilePath)];
            case 11:
                _a.sent();
                return [3 /*break*/, 13];
            case 12:
                e_1 = _a.sent();
                return [3 /*break*/, 13];
            case 13: return [7 /*endfinally*/];
            case 14: return [3 /*break*/, 16];
            case 15:
                error_1 = _a.sent();
                console.error('❌ Error importing OSCAL:', error_1);
                process.exit(1);
                return [3 /*break*/, 16];
            case 16: return [2 /*return*/];
        }
    });
}); });
// Status command - check if a control set uses enriched format
commander_1.program
    .command('status')
    .description('Check the format and structure of a control set')
    .argument('<dir>', 'Control set directory path')
    .action(function (dir) { return __awaiter(void 0, void 0, void 0, function () {
    var fs_1, fullPath, controlsDir_1, metadataDir, controlSetYaml, hasEnrichedControls, hasLegacyControls, controlsContent, yamlFiles, subdirs, hasMetadata, hasControlSet, format, recommendation, controlFiles, sampleSize_1, typeCount, i, filePath, content, yaml, control, error_2, families, totalControls, _i, families_1, family, familyDir, controlFiles, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 10, , 11]);
                return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
            case 1:
                fs_1 = _a.sent();
                fullPath = path.resolve(dir);
                if (!fs_1.existsSync(fullPath)) {
                    console.error("\u274C Directory not found: ".concat(fullPath));
                    process.exit(1);
                }
                console.log("\uD83D\uDD0D Analyzing control set: ".concat(fullPath));
                controlsDir_1 = path.join(fullPath, 'controls');
                metadataDir = path.join(fullPath, 'metadata');
                controlSetYaml = path.join(fullPath, 'control-set.yaml');
                hasEnrichedControls = false;
                hasLegacyControls = false;
                if (fs_1.existsSync(controlsDir_1)) {
                    controlsContent = fs_1.readdirSync(controlsDir_1);
                    yamlFiles = controlsContent.filter(function (f) { return f.endsWith('.yaml'); });
                    subdirs = controlsContent.filter(function (f) {
                        return fs_1.statSync(path.join(controlsDir_1, f)).isDirectory();
                    });
                    hasEnrichedControls = yamlFiles.length > 0 && subdirs.length === 0;
                    hasLegacyControls = subdirs.length > 0 && yamlFiles.length === 0;
                }
                hasMetadata = fs_1.existsSync(metadataDir);
                hasControlSet = fs_1.existsSync(controlSetYaml);
                console.log('\n📋 Structure Analysis:');
                console.log("   Enriched controls: ".concat(hasEnrichedControls ? '✅ Present' : '❌ Missing'));
                console.log("   Framework metadata: ".concat(hasMetadata ? '✅ Present' : '❌ Missing'));
                console.log("   Legacy structure: ".concat(hasLegacyControls ? '⚠️  Present' : '✅ Not present'));
                console.log("   Control set config: ".concat(hasControlSet ? '✅ Present' : '❌ Missing'));
                format = void 0;
                recommendation = void 0;
                if (hasEnrichedControls && hasMetadata) {
                    format = 'Enriched Format';
                    recommendation = hasLegacyControls
                        ? 'Mixed format detected. Legacy structure should be migrated or removed.'
                        : 'Control set is using modern enriched format.';
                }
                else if (hasLegacyControls && hasControlSet) {
                    format = 'Legacy Format';
                    recommendation = 'Consider migrating to enriched format using: import --with-cci=true command';
                }
                else {
                    format = 'Unknown/Incomplete';
                    recommendation = 'Directory structure is incomplete or unrecognized.';
                }
                console.log("\n\uD83C\uDFF7\uFE0F  Format: ".concat(format));
                console.log("\uD83D\uDCA1 Recommendation: ".concat(recommendation));
                if (!hasEnrichedControls) return [3 /*break*/, 9];
                _a.label = 2;
            case 2:
                _a.trys.push([2, 8, , 9]);
                controlFiles = fs_1.readdirSync(controlsDir_1).filter(function (f) { return f.endsWith('.yaml'); });
                console.log("\uD83D\uDCCA Enriched controls: ".concat(controlFiles.length));
                if (!(controlFiles.length > 0)) return [3 /*break*/, 7];
                sampleSize_1 = Math.min(5, controlFiles.length);
                typeCount = { cci: 0, nist: 0, iso: 0, cobit: 0, custom: 0 };
                i = 0;
                _a.label = 3;
            case 3:
                if (!(i < sampleSize_1)) return [3 /*break*/, 6];
                filePath = path.join(controlsDir_1, controlFiles[i]);
                content = fs_1.readFileSync(filePath, 'utf8');
                return [4 /*yield*/, Promise.resolve().then(function () { return require('yaml'); })];
            case 4:
                yaml = _a.sent();
                control = yaml.parse(content);
                if (control.type && typeCount.hasOwnProperty(control.type)) {
                    typeCount[control.type]++;
                }
                _a.label = 5;
            case 5:
                i++;
                return [3 /*break*/, 3];
            case 6:
                console.log('   Types detected:');
                Object.entries(typeCount).forEach(function (_a) {
                    var type = _a[0], count = _a[1];
                    if (count > 0) {
                        console.log("     - ".concat(type.toUpperCase(), ": ").concat(count, "/").concat(sampleSize_1, " samples"));
                    }
                });
                _a.label = 7;
            case 7: return [3 /*break*/, 9];
            case 8:
                error_2 = _a.sent();
                console.log('   ⚠️  Could not analyze enriched controls');
                return [3 /*break*/, 9];
            case 9:
                // Count legacy controls if present
                if (hasLegacyControls) {
                    try {
                        families = fs_1.readdirSync(controlsDir_1).filter(function (f) {
                            return fs_1.statSync(path.join(controlsDir_1, f)).isDirectory();
                        });
                        totalControls = 0;
                        for (_i = 0, families_1 = families; _i < families_1.length; _i++) {
                            family = families_1[_i];
                            familyDir = path.join(controlsDir_1, family);
                            controlFiles = fs_1.readdirSync(familyDir).filter(function (f) { return f.endsWith('.yaml'); });
                            totalControls += controlFiles.length;
                        }
                        console.log("\uD83D\uDCCA Legacy controls: ".concat(totalControls, " across ").concat(families.length, " families"));
                    }
                    catch (error) {
                        console.log('   ⚠️  Could not analyze legacy controls');
                    }
                }
                return [3 /*break*/, 11];
            case 10:
                error_3 = _a.sent();
                console.error('❌ Error analyzing control set:', error_3);
                process.exit(1);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); });
// For backward compatibility, if no command is specified, run serve
var knownCommands = ['init', 'frameworks', 'serve', 'import', 'status'];
var hasKnownCommand = knownCommands.some(function (cmd) { return process.argv.includes(cmd); });
var hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h');
if ((process.argv.length === 2 || !hasKnownCommand) && !hasHelpFlag) {
    process.argv.splice(2, 0, 'serve');
}
commander_1.program.parse();
