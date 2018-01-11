import {
    Component,
    Input,
    Output,
    EventEmitter
} from '@angular/core';
import { NgClass } from '@angular/common';
import { BWComponentBase } from '../../lib'

@Component({
    selector: 'bw-treeview',
    template: `
        <ul [ngClass]="{bwVerticalLine: true}">
        
            <li *ngFor="let item of directories; let i = index"
                (dblclick) = "itemDoubleClick({event:$event, item:item})"
                (click) = "itemClick({event:$event, item:item})"
                [ngClass]="{bwMiddleElement: i < directories.length,
                            bwLastElement: i == directories.length-1}">
        
                <span>
                    <input type="checkbox"
                           [checked]="item?.checked"
                           (click)="check({event:$event, item:item})"/>
                </span>
        
                <i class="fa fa-folder-open text-yellow fa-lg" *ngIf="item.type == 'folder' && item.children && item.children?.length > 0" ></i>
                <i class="fa fa-folder text-yellow" *ngIf="item.type == 'folder' && (!item?.children || item.children?.length == 0)" ></i>
                <i class="fa fa-file text-azure" *ngIf="item.type == 'file'" ></i>
        
                {{item.name}}
        
                <div *ngIf="item.children && item.children?.length > 0">
                    <bw-treeview [directories]="item?.children"
                                 (openItem)="itemDoubleClick($event)"
                                 (previewItem)="itemClick($event)"
                                 (selectedItems)="check($event)"></bw-treeview>
                </div>
            </li>
            
        </ul>
    `,

    styles: [
        `
            .bwVerticalLine {
                list-style-type: none;
                background: url(/images/vline.png) repeat-y;
                margin: 0;
                padding: 0;
                margin-left: 25px;}
                
            .bwMiddleElement {
                margin: 0;
                padding: 0 12px;
                line-height: 20px;
                background: url(/images/node.png) no-repeat;
                color: #369;
                font-weight: bold;
            }
            
            .bwLastElement {
                background: #fff url(/images/lastnode.png) no-repeat;
            }
                
  `
    ]

})

export class BWTreeView extends BWComponentBase {
    @Input() directories = [];

    // Mandatory fields: name, type
    // type could be "file" or "folder"
    // Example:
    // directories = [
    //     {
    //         "name": "folder_1",
    //         "type": "folder",
    //         "children": []
    //     },
    //     {
    //         "name": "folder_2",
    //         "type": "folder",
    //         "children": [
    //             {
    //                 "name": "folder_2_1",
    //                 "type": "folder",
    //                 "children": [
    //                     {
    //                         "name": "folder_2_1_1",
    //                         "type": "folder",
    //                         "children": []
    //                     },
    //                     {
    //                         "name": "folder_2_1_2",
    //                         "type": "folder",
    //                         "children": [
    //                             {
    //                                 "name": "file_2_1_2_1",
    //                                 "type": "file"
    //                             }
    //                         ]
    //                     }
    //                 ]
    //             },
    //             {
    //                 "name": "folder_2_2",
    //                 "type": "folder",
    //                 "children": []
    //             }
    //         ]
    //     },
    //     {
    //         "name": "file_3",
    //         "type": "file",
    //         "children": []
    //     }
    // ]


    @Output() selectedItems: EventEmitter<any> = new EventEmitter();   // check()
    @Output() openItem: EventEmitter<any> = new EventEmitter();        // itemDoubleClick()
    @Output() previewItem: EventEmitter<any> = new EventEmitter();     // itemClick()

    private _timer;   // To separate itemDoubleClick() and itemClick() functions with the delay 200ms
    private _delay = 200;
    private _prevent = false;


    constructor(
    ) {
        super();
    }


    itemDoubleClick (payload){
        clearTimeout(this._timer);
        this._prevent = true;
        this.openItem.emit (payload);
        payload.event.stopPropagation(); // To prevent firing event onto the upper level
    };


    itemClick(payload){
        this._timer = setTimeout(
            () => {
                if (!this._prevent) {
                    this.previewItem.emit (payload);
                }
                this._prevent = false;
            }, 200);
        payload.event.stopPropagation(); // To prevent firing event onto the upper level
    }


    check (payload){
        if (!Array.isArray(payload.item)){
            payload.item.checked = !payload.item.checked;
            this.checkRecursive (payload.item, payload.item.checked);
        }
        this.selectedItems.emit ({
            "event": payload.event,
            "item": this.getSelected(this.directories) // Unfortunately the function is called in each parent component
        });
        payload.event.stopPropagation(); // To prevent firing event onto the upper level
    };


    checkRecursive(item, state){
        if (item.children && item.children.length > 0){
            for (let i = 0; i < item.children.length; i++){
                item.children[i].checked = state;
                this.checkRecursive(item.children[i], state);
            }
        }
    };


    getSelected(directories){
        let selected = [];

        function getSelectRecursive(item){
            if (item.checked == true) selected.push(item);
            if (item.children && item.children.length > 0) {
                for (let i = 0; i < item.children.length; i++) {
                    getSelectRecursive(item.children[i]);
                }
            }
        }

        for (let i = 0; i < directories.length; i++){
            getSelectRecursive(directories[i]);
        }

        return selected;
    }

}