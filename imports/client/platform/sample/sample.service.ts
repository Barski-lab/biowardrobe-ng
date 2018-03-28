'use strict';

import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Samples } from '../../../collections/shared';
import { BWServiceBase, BWAccountService } from '../../lib';


@Injectable()
export class BWSampleService extends BWServiceBase {

    public getSample(params):Observable<any> {
        if( Samples.findOne(params) ) {
            return Observable.of(Samples.findOne(params));
        } else
            return this.MeteorSubscribeAutorun("samples/get", params, () => {
                return Samples.findOne(params)
            });
    }

    public addSample (){
        return this.MeteorCall("samples/create");
    }

    public editSample (sampleId, params){
        return this.MeteorCall("samples/upsert", sampleId, params);
    }

    public getSampleAll():Observable<any> {
        return this.MeteorSubscribeAutorun("samples/get", {}, () => {
            return Samples.find({}).fetch()
        });
    }

}

