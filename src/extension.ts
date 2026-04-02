import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const MAX_DEPTH = 6;
const MAX_CHILDREN = 200;

async function fetchVariables(
    session: vscode.DebugSession,
    variablesReference: number,
    depth: number = 0
): Promise<any> {
    if (variablesReference === 0 || depth >= MAX_DEPTH) {
        return undefined;
    }

    try {
        const response = await session.customRequest('variables', {
            variablesReference,
            count: MAX_CHILDREN
        });

        const vars = response.variables as any[];
        if (!vars || vars.length === 0) return {};

        // Detecta se é array numérico (índices 0,1,2...)
        const isArray = vars.every((v: any) => /^\d+$/.test(v.name));

        if (isArray) {
            const arr: any[] = [];
            for (const v of vars) {
                if (v.variablesReference > 0) {
                    arr.push(await fetchVariables(session, v.variablesReference, depth + 1));
                } else {
                    arr.push(parseValue(v.value));
                }
            }
            return arr;
        } else {
            const obj: Record<string, any> = {};
            for (const v of vars) {
                if (v.variablesReference > 0) {
                    obj[v.name] = await fetchVariables(session, v.variablesReference, depth + 1);
                } else {
                    obj[v.name] = parseValue(v.value);
                }
            }
            return obj;
        }
    } catch {
        return '[erro ao expandir]';
    }
}

function parseValue(raw: string): any {
    if (raw === '.T.' || raw === 'true') return true;
    if (raw === '.F.' || raw === 'false') return false;
    if (raw === 'nil' || raw === 'null' || raw === 'undefined') return null;
    const num = Number(raw);
    if (!isNaN(num) && raw.trim() !== '') return num;
    // Remove aspas se for string
    if ((raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1);
    }
    return raw;
}

async function collectAllVars(): Promise<Record<string, any>> {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
        throw new Error('Nenhuma sessão de debug ativa');
    }

    // Threads
    const threadsResp = await session.customRequest('threads');
    const threads = threadsResp.threads as any[];
    if (!threads || threads.length === 0) throw new Error('Nenhuma thread ativa');

    const threadId = threads[0].id;

    // Stack
    const stackResp = await session.customRequest('stackTrace', {
        threadId,
        startFrame: 0,
        levels: 1
    });
    const frames = stackResp.stackFrames as any[];
    if (!frames || frames.length === 0) throw new Error('Nenhum stack frame disponível. Está pausado em um breakpoint?');

    const frameId = frames[0].id;

    // Escopos
    const scopesResp = await session.customRequest('scopes', { frameId });
    const scopes = scopesResp.scopes as any[];

    const result: Record<string, any> = {
        _meta: {
            timestamp: new Date().toISOString(),
            thread: threads[0].name || `Thread ${threadId}`,
            frame: frames[0].name || 'frame 0',
            source: frames[0].source?.path || '',
            line: frames[0].line || 0
        }
    };

    for (const scope of scopes) {
        result[scope.name] = await fetchVariables(session, scope.variablesReference);
    }

    return result;
}

async function askIncludeTable(): Promise<boolean> {
    const choice = await vscode.window.showQuickPick(
        [
            { label: '$(exclude) Somente Local / Public', description: 'Exclui o escopo Table (recomendado)', value: false },
            { label: '$(database) Incluir Table', description: 'Exporta tudo, incluindo metadados do Protheus', value: true }
        ],
        { placeHolder: 'Incluir escopo Table na exportação?' }
    );
    if (choice === undefined) throw new Error('Cancelado pelo usuário');
    return (choice as any).value;
}

function filterScopes(vars: Record<string, any>, includeTable: boolean): Record<string, any> {
    if (includeTable) return vars;
    const result: Record<string, any> = {};
    for (const key of Object.keys(vars)) {
        if (key !== 'Table') result[key] = vars[key];
    }
    return result;
}

async function exportToClipboard() {
    try {
        const includeTable = await askIncludeTable();
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Exportando variáveis...' },
            async () => {
                try {
                    const vars = filterScopes(await collectAllVars(), includeTable);
                    const json = JSON.stringify(vars, null, 2);
                    await vscode.env.clipboard.writeText(json);
                    vscode.window.showInformationMessage(
                        `✅ Copiado! (${json.length} chars${includeTable ? '' : ' — Table excluído'})`
                    );
                } catch (err: any) {
                    vscode.window.showErrorMessage(`❌ Erro: ${err.message}`);
                }
            }
        );
    } catch (err: any) {
        if (err.message !== 'Cancelado pelo usuário') {
            vscode.window.showErrorMessage(`❌ Erro: ${err.message}`);
        }
    }
}

async function exportToFile() {
    try {
        const includeTable = await askIncludeTable();
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Exportando variáveis...' },
            async () => {
                try {
                    const vars = filterScopes(await collectAllVars(), includeTable);
                    const json = JSON.stringify(vars, null, 2);

                // Sugere salvar no workspace ou home
                const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                const defaultPath = wsFolder
                    ? path.join(wsFolder, `debug-vars-${Date.now()}.json`)
                    : path.join(require('os').homedir(), `debug-vars-${Date.now()}.json`);

                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(defaultPath),
                    filters: { 'JSON': ['json'] },
                    title: 'Salvar variáveis do debug'
                });

                if (uri) {
                    fs.writeFileSync(uri.fsPath, json, 'utf8');
                    const openDoc = await vscode.window.showInformationMessage(
                        `✅ Salvo em ${path.basename(uri.fsPath)}`,
                        'Abrir arquivo'
                    );
                    if (openDoc === 'Abrir arquivo') {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(doc);
                    }
                }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`❌ Erro: ${err.message}`);
                }
            }
        );
    } catch (err: any) {
        if (err.message !== 'Cancelado pelo usuário') {
            vscode.window.showErrorMessage(`❌ Erro: ${err.message}`);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('debugVars.exportToClipboard', exportToClipboard),
        vscode.commands.registerCommand('debugVars.exportToFile', exportToFile)
    );
}

export function deactivate() {}
