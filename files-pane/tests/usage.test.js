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
var testing_1 = require("claude-code/testing");
var register_1 = require("../hooks/register");
var LIMITS = [
    { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-15T20:40:00Z' },
    { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-19T14:00:00Z' },
];
var NOW = Date.parse('2026-10-15T12:00:00Z');
var PROPS = { title: 'Files', isFocused: false, bodyColumns: 80 };
(0, testing_1.test)('meter fills in tenths and clamps', function () {
    (0, testing_1.expect)((0, register_1.meter)(0)).toBe('░░░░░░░░░░');
    (0, testing_1.expect)((0, register_1.meter)(23.5)).toBe('██░░░░░░░░');
    (0, testing_1.expect)((0, register_1.meter)(150)).toBe('██████████');
});
(0, testing_1.test)('resets shows the weekday only on later days', function () {
    var now = new Date(NOW);
    (0, testing_1.expect)((0, register_1.resets)('2026-10-15T13:00:00Z', now)).not.toMatch(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/);
    (0, testing_1.expect)((0, register_1.resets)('2026-10-19T14:00:00Z', now)).toMatch(/^resets (Sun|Mon|Tue) /);
    (0, testing_1.expect)((0, register_1.resets)(undefined, now)).toBe('');
});
var _loop_1 = function (surface) {
    (0, testing_1.test)("status card shows usage on ".concat(surface, " and keeps it through an empty reading"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var ui, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    testing_1.mock.clock(on, { now: NOW });
                    on('process.run', function () { return ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }); });
                    on('fs.list', function () { return ({ value: [] }); });
                    on('session.measure', function (_$, e) { return ({ changed: e.changed }); });
                    on('session.start', function (_$, e) { return ({ cwd: e.cwd }); });
                    on('command.register', function () { return ({ value: { command: 'file-pane' } }); });
                    on('ui.open', function () { return ({ value: { isPlaced: false } }); });
                    on('session.usage', function () { return ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }); });
                    return [4 /*yield*/, $.session.start({ cwd: '/tmp/project', surface: surface, isInteractive: true })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, $.session.measure({ context: { window: 200000 }, rateLimits: LIMITS, changed: ['rateLimits'] })];
                case 2:
                    _d.sent();
                    return [4 /*yield*/, $.ui.mount({ plugin: 'files-pane', surface: surface, component: 'Pane', requestId: 'files-pane', props: PROPS })];
                case 3:
                    ui = _d.sent();
                    _a = testing_1.expect;
                    return [4 /*yield*/, ui.find({ text: '24%' })];
                case 4:
                    _a.apply(void 0, [_d.sent()]).toBeDefined();
                    _b = testing_1.expect;
                    return [4 /*yield*/, ui.find({ text: '41%' })];
                case 5:
                    _b.apply(void 0, [_d.sent()]).toBeDefined();
                    return [4 /*yield*/, $.session.measure({ context: { window: 200000 }, rateLimits: [], changed: ['rateLimits'] })];
                case 6:
                    _d.sent();
                    return [4 /*yield*/, ui.redraw()];
                case 7:
                    _d.sent();
                    _c = testing_1.expect;
                    return [4 /*yield*/, ui.find({ text: '41%' })];
                case 8:
                    _c.apply(void 0, [_d.sent()]).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _i = 0, _a = ['terminal', 'desktop']; _i < _a.length; _i++) {
    var surface = _a[_i];
    _loop_1(surface);
}
