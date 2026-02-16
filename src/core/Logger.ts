import * as vscode from 'vscode';

export class Logger {
    constructor(private readonly output: vscode.OutputChannel) {}

    public info(message: string): void {
        this.output.appendLine(`[INFO] ${message}`);
    }

    public warn(message: string): void {
        this.output.appendLine(`[WARN] ${message}`);
    }

    public error(message: string): void {
        this.output.appendLine(`[ERROR] ${message}`);
    }

    public debug(message: string): void {
        this.output.appendLine(`[DEBUG] ${message}`);
    }
}
