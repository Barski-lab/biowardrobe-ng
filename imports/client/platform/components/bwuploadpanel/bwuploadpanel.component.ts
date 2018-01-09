import {
    Component,
    EventEmitter,
    Input,
    NgZone,
    Output
} from "@angular/core";

import { FileObj, FilesCollection } from "meteor/ostrio:files";
import { MatDialog } from "@angular/material";

import { BWCancelDialog } from "./bwcanceldialog.component";

import template from "./bwuploadpanel.html"

import style from "./bwuploadpanel.scss"

export enum UploadStatus{
    PICK_FILE = 0,
    CONFIRM_PICK = 1,
    UPLOADING = 2,
    DONE = 3,
    ERROR = 4
}

type UploadStatusString = "PICK_FILE" | "CONFIRM_PICK" | "UPLOADING" | "DONE" | "ERROR";


@Component({
    selector: 'bw-uploadpanel',
    template,
    styles: [style]
})
export class BWUploadPanel{
    //Useful Constants
    private tooltipDelay:number = 500; //ms
    //Workflow Mangement
    private _currentStatus:UploadStatus = UploadStatus.PICK_FILE;
    //Formatting
    private currentFileName:string = 'Choose a file...';
    private loadProgress:number = 0; //%
    private loadFraction:string="/";
    private barColor:string = "primary";
    //File Upload
    private currentFile; //File or FileObj
    private currentUpload; //FileInsert Object (see "insert()" in ostrio:files docs)
    private errorMessage:string = "";

    /**
     * title - The content of the displayed header. Is just string for now.
     */
    @Input('title')
    sectionTitle:string;

    /**
     * storagePath - The Relative storage path of where you want the file stored.
     * If not provided, uploaded file will simply be placed into home directory
     */
    @Input('storagePath')
    storagePath:string;

    /**
     * fileCollection - The given ostrio:files collection to insert the uploaded file into.
     */
    @Input('fileCollection')
    currentCollection:FilesCollection;

    /**
     * Gives the current upload status as one of the following strings:
     * "PICK_FILE" | "CONFIRM_PICK" | "UPLOADING" | "DONE" | "ERROR"
     * @type {EventEmitter<UploadStatusString>}
     */
    @Output('onStatusChange')
    statusStringEmitter:EventEmitter<UploadStatusString> = new EventEmitter<UploadStatusString>();


    /*
        Prepare dialog and zone, and set state during init.
     */
    constructor(private _zone:NgZone, public dialog: MatDialog){}
    ngOnInit(){this.pickNewFile();}

    /**
     * Given an array of state values, it will return true if the current state is contained.
     * @param states
     * @returns {boolean}
     */
    checkStatus(states:UploadStatus[]|number[]){
        for(let i=0;i<states.length;i++){
            if(states[i]==this._currentStatus){return true; }
        }
        return false;
    }

    /**
     * Both sets the current status and emits the string literal on the output stream.
     * @param newStatus
     */
    private setStatus(newStatus:UploadStatus){
        this._currentStatus = newStatus;
        switch(newStatus){
            case UploadStatus.PICK_FILE:
                this.statusStringEmitter.emit("PICK_FILE");
                this.loadProgress = 0;
                this.currentFileName = "Choose a file...";
                break;
            case UploadStatus.CONFIRM_PICK:
                this.statusStringEmitter.emit("CONFIRM_PICK");
                break;
            case UploadStatus.UPLOADING:
                this.statusStringEmitter.emit("UPLOADING");
                this.barColor = "primary";
                break;
            case UploadStatus.DONE:
                this.statusStringEmitter.emit("DONE");
                this.barColor = "accent";
                break;
            case UploadStatus.ERROR:
                this.statusStringEmitter.emit("ERROR");
                this.barColor = "warn";
                this.currentFileName = "Choose a new file...";
                break;
            default:
                throw 'Illegal Status';
        }
    }
    /*
        State methods:
        Theses methods perform the neccessary entry actions with the associated state.
     */
    /**
     * Transitions to PICK_FILE state.
     */
    pickNewFile(){
        this.setStatus(UploadStatus.PICK_FILE);
    }
    /**
     * Transitions to CONFIRM_PICK state.
     * @param $event - File from file input.
     */
    prepareFile($event:File){
        this.currentFileName = $event.name;
        this.currentFile = $event;
        this.setStatus(UploadStatus.CONFIRM_PICK);
    }

    /**
     * Transitions to UPLOADING state. Also prepares enter actions towards ERROR and DONE states,
     * and prepares the associated events.
     */
    startUpload(){
        if(!!this.currentFile){
            //@TODO: Consider stripping metadata.
            if(this.currentFile.meta && !this.currentFile.meta.storagePath && this.storagePath){
                this.currentFile.meta.storagePath = this.storagePath;
            } else if(!this.currentFile.meta){
                this.currentFile.meta = {storagePath:this.storagePath};
            }
            console.log(this.currentFile.meta);
            this.setStatus(UploadStatus.UPLOADING);
            this.currentUpload = this.currentCollection.insert({
                file:this.currentFile,
                onProgress: (progress,fileObj) => {this._zone.run(()=>{
                    this.loadProgress = progress;
                    this.loadFraction = this.getFileSizeString(this.currentFile.size * (this.loadProgress/100))
                        +" / "+this.getFileSizeString(this.currentFile.size);
                });},
                onUploaded: (err,fileObj:FileObj) => {
                    this._zone.run(()=>{
                        if(err){this.errorMessage=err.toString();throw err;}
                        else{
                            console.log("File Uploaded: " + fileObj.name);
                            this.setStatus(UploadStatus.DONE);
                        }});

                    },
                onAbort: fileData => {this.errorMessage = "Upload Aborted!";console.log("Upload of File Aborted");},
                meta: this.currentFile.meta
            });
        }
    }
    /**
     * Asks user to confirm cancel then performs exit actions towards ERROR state.
     */
    cancelUpload(){
        this.dialog.open(BWCancelDialog).afterClosed().subscribe(result=>{
            if(result === "abort"){
                this.currentUpload.abort();
                this.setStatus(UploadStatus.ERROR);
            }
        });
    }
    /**
     * A method that takes a count of bytes then returns an appropertly sized rounded string with label.
     * @param bytes
     * @requires bytes:number < 1000Pb
     * @returns {string}
     */
    getFileSizeString(bytes:number):string{
        let roundedBytes = Math.floor(bytes);
        let labels:string[] = ["b","Kb","Mb","Gb","Tb","Pb"];
        let numberLength:number = roundedBytes.toString().length;
        let orderOfMagnitude = Math.floor((numberLength-1)/3);
        //Rounds adjusted value to one decimal place;
        let adjustedAmount = Math.round((roundedBytes / Math.pow(10,3*orderOfMagnitude)*10))/10;
        return adjustedAmount + labels[orderOfMagnitude];
    }

}
