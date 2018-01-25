'use strict';

import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Samples } from '../../../collections/shared';
import { BWServiceBase, BWAccountService } from '../../lib';


@Injectable()
export class BWSampleService extends BWServiceBase {

    public getSample(params):Observable<any> {
        if( Samples.findOne( {'_id': params._id}) ) {
            return Observable.of(Samples.findOne( {'_id': params._id} ));
        } else
            return this.MeteorSubscribeAutorun("samples/get", params, () => {
                return Samples.findOne( {'_id': params._id} )
            });
    }

    public addSample (){
        return this.MeteorCall("samples/create");
    }


}

