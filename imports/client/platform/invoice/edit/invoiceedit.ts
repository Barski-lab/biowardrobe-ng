// import { Component, NgZone } from '@angular/core'
// import { ActivatedRoute } from '@angular/router'
//
// import { BWInvoiceService } from '../invoice.service'
//
// import { Observable } from 'rxjs';
//
// import template from './invoiceedit.html'
//
// @Component({
//     selector: 'invoice',
//     template: template,
// })
//
// export class BWInvoiceEdit{
//
//     invoice: any;
//     invoiceid: any;
//
//     constructor(
//         private _zone:NgZone,
//         private _route:ActivatedRoute,
//         private _labs:SDLabsService,
//         private _invoices:BWInvoiceService
//     ) {
//         Observable.zip(this._route.params,this._labs.labsListPersonalized$,
//             (p, l) => {
//                 this.invoiceid = p['id'];
//                 return l.myLab;
//             }
//         ).subscribe(l => _invoices.getInvoice(this.invoiceid,l._id).then( inv => this._zone.run(() => this.invoice = inv)) );
//     }
// // {{return '\u2116'}}
//
//     getTime(t) {
//         return Math.floor(t/60)+":"+(Math.ceil(t)%60);
//     }
//     experimentSize(s) {
//         return (s/1024).toFixed(2);
//     }
//     ePrice(p) {
//         return Math.floor(p*100)/100;
//     }
//     showInvoice(i) {
//         // console.log(i);
//     }
//
//     dateFormat(d) {
//         var date= new Date(d);
//         var day = ("00"+date.getDate()).slice(-2);
//         var m = ("00"+(date.getMonth()+1)).slice(-2);
//         var year = date.getFullYear();
//         return m+"/"+day+"/"+year;
//     }
//
//     printThis(id) {
//         // <link href="/css/bootstrap.min.css" rel="stylesheet" media="screen">
//         // <link href="/css/bootstrap-social.css" rel="stylesheet" media="screen">
//         // <link href="/css/font-awesome.min.css" rel="stylesheet" media="screen">
//         // <link href="/css/themify-icons.css" rel="stylesheet" media="screen">
//         // <link href="/css/animate.min.css" rel="stylesheet" media="screen">
//         // <link href="/css/sweetalert2.css" rel="stylesheet" media="screen">
//         // <link href="/css/swiper.min.css" rel="stylesheet" media="screen">
//         // <link href="/css/platform/styles.css" rel="stylesheet" media="screen">
//         // <link href="/css/platform/plugins.css" rel="stylesheet" media="screen">
//         // <link href="/css/platform/themes/{{theme}}" rel="stylesheet" media="screen">
//
//         jQuery(id).printThis({
//             debug: false,
//             importCSS: true,
//             importStyle: true,
//             printContainer: true,
//             loadCSS: ["/css/bootstrap.min.css","/css/bootstrap-social.css","/css/font-awesome.min.css","/css/platform/styles.css","/css/platform/plugins.css"],
//             pageTitle: "invoice",
//             removeInline: false,
//             printDelay: 333,
//             header: null,
//             formValues: true
//         });
//     }
//     saveContent(c) {
//         // var emails=Meteor.users.findOne({"_id":this.invoice.to.lab.owner._id},{fields:{"emails":1}}).emails[0].address;
//         // document.location.href = "mailto:"+emails+"?subject="
//         //     + encodeURIComponent('')
//         //     + "&body=";
//         //     //escape(c.document.documentElement.innerHTML);
//     }
//
//     sendMail(id)
//     {
//         jQuery(id).printThis({
//             debug: false,
//             importCSS: true,
//             importStyle: true,
//             printContainer: true,
//             loadCSS: ["/css/bootstrap.min.css","/css/bootstrap-social.css","/css/font-awesome.min.css","/css/platform/styles.css","/css/platform/plugins.css"],
//             pageTitle: "invoice",
//             removeInline: false,
//             printDelay: 333,
//             header: null,
//             formValues: true,
//             save: true,
//             content: this.saveContent.bind(this)
//         });
//     }
// }
