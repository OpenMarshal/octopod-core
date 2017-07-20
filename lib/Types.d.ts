export interface ServiceInput {
    data: any;
    path: string;
    outputs: {
        [method: string]: string[];
    };
    mainOutput: string;
}
export interface ServiceInputResponse {
    inputPath: string;
    inputFileName: string;
    outputs: {
        [method: string]: string[];
    };
    mainOutput: string;
}
