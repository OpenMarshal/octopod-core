import { VirtualStoredSerializer, DeCipherOptions } from '@webdav-server/virtual-stored'
import { v2 as webdav } from 'webdav-server'

export interface ServiceInput
{
    data : any,
    path : string,
    outputs : { [method : string] : string[] },
    mainOutput : string
}

export interface ServiceInputResponse
{
    inputPath : string,
    inputFileName : string,
    outputs : { [method : string] : string[] },
    mainOutput : string
}
