import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable} from 'rxjs';

import { BWServiceBase } from './service.base';

import { Drafts } from '../../collections/shared';


@Injectable()
export class BWDraftService extends BWServiceBase {

    // TODO If cwl.service.ts works good with shareReplay(1), use it instead of BehaviorSubject(null)

    private _draft$:BehaviorSubject<any> = new BehaviorSubject<any>(null);
    public get draft$():Observable<any> {
        return this._draft$.filter( _ => !!_ );
    }

    constructor() {
        super();
        this.MeteorSubscribeAutorun("drafts",() => Drafts.find({}).fetch()).subscribe(this._draft$);
    }

    getDraft(draftId:string):Observable<any|null> {
        console.log ("getDraft");
        let d = Drafts.findOne({formId: draftId});
        if(d) {
            return Observable.of(d['fields']);
        }
        return this.draft$.map( _d => {
            let l = _d.find( (item) => item['formId'] == draftId);
            return l?l['fields']:null;
        });
    }
}

