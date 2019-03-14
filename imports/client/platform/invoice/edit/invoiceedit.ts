import { Component, NgZone, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BWComponentBase } from '../../../lib'
import { BWInvoiceService } from '../invoice.service'


@Component({
    templateUrl: './invoiceedit.html'
})
export class BWInvoiceEdit extends BWComponentBase implements AfterViewInit {

    private _invoiceData: any;

    constructor(
        private _zone:    NgZone,
        private _route:   ActivatedRoute,
        private _invoice: BWInvoiceService
    ) {
        super();
    }

    ngAfterViewInit() {
        this.tracked = this._route.params
            .flatMap(params => {
                return this._invoice.getInvoice({_id: params['invoice_id']});
            })
            .subscribe(invoiceData => {
                this._zone.run(() => {
                    this._invoiceData = invoiceData;
                });
            });
    }

    getTime(t) {
        return Math.floor(t/60) + ":" + (Math.ceil(t)%60);
    }

    experimentSize(s) {
        return (s/1024).toFixed(2);
    }

    ePrice(p) {
        return Math.floor(p*100) / 100;
    }

    dateFormat(d) {
        var date= new Date(d);
        var day = ("00" + date.getDate()).slice(-2);
        var m = ("00" + (date.getMonth() + 1)).slice(-2);
        var year = date.getFullYear();
        return m + "/" + day + "/" + year;
    }

    printInvoice(id) {
        // <link href="/css/bootstrap.min.css" rel="stylesheet" media="screen">
        // <link href="/css/bootstrap-social.css" rel="stylesheet" media="screen">
        // <link href="/css/font-awesome.min.css" rel="stylesheet" media="screen">
        // <link href="/css/themify-icons.css" rel="stylesheet" media="screen">
        // <link href="/css/animate.min.css" rel="stylesheet" media="screen">
        // <link href="/css/sweetalert2.css" rel="stylesheet" media="screen">
        // <link href="/css/swiper.min.css" rel="stylesheet" media="screen">
        // <link href="/css/platform/styles.css" rel="stylesheet" media="screen">
        // <link href="/css/platform/plugins.css" rel="stylesheet" media="screen">
        // <link href="/css/platform/themes/{{theme}}" rel="stylesheet" media="screen">

        jQuery(id).printInvoice({
            debug: false,
            importCSS: true,
            importStyle: true,
            printContainer: true,
            loadCSS: ["/css/bootstrap.min.css","/css/bootstrap-social.css","/css/font-awesome.min.css","/css/platform/styles.css","/css/platform/plugins.css"],
            pageTitle: "invoice",
            removeInline: false,
            printDelay: 333,
            header: null,
            formValues: true
        });
    }

}
