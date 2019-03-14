import { Component, NgZone, AfterViewInit } from '@angular/core';
import { ITdDataTableColumn } from '@covalent/core';

import { BWComponentBase } from '../../../lib'
import { BWInvoiceService } from '../invoice.service'
import { Router } from '@angular/router';


@Component({
    templateUrl: './invoicelist.html'
})
export class BWInvoiceList extends BWComponentBase implements AfterViewInit {

    private _data = [];

    private _columns: ITdDataTableColumn[] = [
        { name: '_id',               hidden: true},
        { name: 'invoiceNumber',     label: 'Invoice \u2116', filter: true},
        { name: 'laboratoryName',    label: 'Laboratory',     filter: true},
        { name: 'billingBu',         label: 'BU' },
        { name: 'billingFund',       label: 'FUND' },
        { name: 'billingDep',        label: 'DEP' },
        { name: 'billingAcc',        label: 'ACC' },
        { name: 'billingPcbu',       label: 'PC BU' },
        { name: 'billingPrj',        label: 'PRJ' },
        { name: 'billingBr',         label: 'BR' },
        { name: 'billingAcode',      label: 'ACODE' },
        { name: 'totalPrice',        label: 'Cost (USD)',   numeric: true, format: v => v.toFixed(2) },
        { name: 'totalTransactions', label: 'Transactions', numeric: true }
    ];

    onRowClick (payload){
        this._router.navigate(['/platform/invoice', {invoice_id: payload.row._id}]);
    }

    createInvoice (invoiceDate){
        this._invoice.createInvoice(invoiceDate);
    }

    constructor(
        private _invoice: BWInvoiceService,
        private _zone: NgZone,
        private _router: Router
    ) {
        super();
    }

    static _refactorInvoiceData(singleInvoiceData){
        return {
            "_id":               singleInvoiceData._id,
            "invoiceNumber":     singleInvoiceData.number,
            "laboratoryName":    singleInvoiceData.to.lab.name,
            "billingBu":         singleInvoiceData.to.billing.bu,
            "billingFund":       singleInvoiceData.to.billing.fund,
            "billingDep":        singleInvoiceData.to.billing.dep,
            "billingAcc":        singleInvoiceData.to.billing.acc,
            "billingPcbu":       singleInvoiceData.to.billing.pcbu,
            "billingPrj":        singleInvoiceData.to.billing.prj,
            "billingBr":         singleInvoiceData.to.billing.br,
            "billingAcode":      singleInvoiceData.to.billing.acode,
            "totalPrice":        singleInvoiceData.total.price,
            "totalTransactions": singleInvoiceData.total.transactions
        };
    }

    ngAfterViewInit() {
        this.tracked = this._invoice.getInvoiceAll()
            .subscribe(allInvoiceData => {
                this._zone.run(() => {
                    this._data = allInvoiceData.map(singleInvoiceData => {
                        return BWInvoiceList._refactorInvoiceData(singleInvoiceData);
                    });
                });
            });
    }

}