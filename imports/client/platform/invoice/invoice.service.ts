'use strict';

import { Meteor } from 'meteor/meteor';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Invoices } from '../../../collections/shared';
import { BWServiceBase, BWAccountService } from '../../lib';


@Injectable()
export class BWInvoiceService extends BWServiceBase {

    public getInvoiceAll():Observable<any> {
        return this.MeteorSubscribeAutorun("invoices/get", {}, () => {
            return Invoices.find({}).fetch()
        });
    }

    public getInvoice(params):Observable<any> {
        if( Invoices.findOne(params) ) {
            return Observable.of(Invoices.findOne(params));
        } else
            return this.MeteorSubscribeAutorun("invoices/get", params, () => {
                return Invoices.findOne(params)
            });
    }

}

