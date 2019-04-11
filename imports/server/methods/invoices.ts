import { Meteor } from 'meteor/meteor';
import { of } from 'rxjs/observable/of';
import { Log } from '../modules/logger';
import { Invoices, Labs, Projects, Samples } from '../../collections/shared';
import { Pricing, Billing } from '../../collections/server';
import { FilesUpload } from './filesupload';

const stats: any = {
    storage: 0,
    cputime: 0,
    users: 0,
    experiments: 0,
    newexperiments: 0,
    date: 0
};

function getPeriodPrice(rule) { //t comes from applied:{,t:"m"}
    if(rule.price.t == rule.charge.t)
        return rule.price.v;

    let p = rule.price.v;

    switch (rule.price.t) {
        case "d":
            p = p*365; //price for a year
            break;
        case "m":
            p = p*12; //price for a year
            break;
    }

    switch (rule.charge.t) {
        case "d":
            p = (p/365).toFixed(4);
            break;
        case "m":
            p = (p/12).toFixed(4);
            break;
    }
    return p;
}

function getDiff(d, v, t) {
    let f;

    if(v ==  null)
        v = 1;

    let _d;

    switch (t) {
        case "mm":
            _d = new Date(d.setMinutes(d.getMinutes()-v));
            f = "getMinutes";
            break;
        case "d":
            _d = new Date(new Date(d).setDate(d.getDate()-v));
            f = "getDate";
            break;
        case "m":
            let max_date_s = (new Date (d.getFullYear(),d.getMonth()-v+1,0)).getDate();
            if(d.getDate() == 1) {
                _d = new Date(d.getFullYear(), d.getMonth() - v, 1, 0 , 0, 0);
            } else {
                _d = new Date(d.getFullYear(), d.getMonth() - v, max_date_s, 23, 59, 59);
            }
            f = "getMonth";
            break;
        case "y":
            _d = new Date(d.getFullYear()-v, d.getMonth(),d.getDate(), d.getHours() , d.getMinutes(), d.getSeconds());
            f = "getYear";
            break;
    }
    return _d; //new Date(d[f]() - v);
}

function getExclude(_d, rule, inv, _id) { //returns number of invoices for the experiment _id
    return inv.find({
        $and:[
            {
                "invoice.transactions._id": _id
            },{
                "issued": {$gt: new Date(getDiff(_d, 1, rule.charge.t))}
            }
        ]});
}

function getApplied(_datea, endDate, rule) {
    let s = getDiff(endDate, rule.charge.v, rule.charge.t);
    return [(rule.charge.v == null) || (_datea > s), s];
}

function getRule(_datea, endDate, pricing) {
    for(let i = 0; i < pricing.rules.length; i++){
        let rule = pricing.rules[i];
        let s = getApplied(_datea, endDate, rule);
        if(s[0]) {
            return [rule,i];
        }
    }
    return null;
}


function ruleWorkflow(dateA, endDate, billing, dbilling, invs, id, subscr) {
    let rule = getRule(dateA, endDate, billing);
    let price = 0;
    if(!rule[0].includes.v) { //Kind of default rule
        if(getExclude(endDate, rule[0], invs, id).count() > 0) { // Should be ignored already charged for this rule

        } else { // Should be charged new transaction for this rule.
            price = getPeriodPrice(rule[0]);
        }
    } else {
        let mamount = (rule[0].includes.v)*1;
        if(!subscr[rule[1]])
            subscr[rule[1]] = { ma: mamount, count: 1 };

        if(subscr[rule[1]].count > subscr[rule[1]].ma) { //apply default rule
            rule = getRule(dateA, endDate, dbilling);
            if(getExclude(endDate,rule[0],invs,id).count() > 0) { // Should be ignored already charged for this rule

            } else { // Should be charged new transaction for this rule.
                price = getPeriodPrice(rule[0]);
            }
        } else { // already paid by subscription
            subscr[rule[1]].count++;
        }
    }
    return price;
}

function getInvoices(_now = new Date()) {

    if (!Meteor.settings["billing"]){
        Log.debug("Skip invoice generation. Billing information is absent in the settings file");
        return of(1);
    }

    let startDate = new Date(_now.getFullYear(), _now.getMonth() - 1, 1, 0, 0, 0);
    let endDate = new Date(_now.getFullYear(), _now.getMonth(), 0, 23, 59, 59);
    let yearAgo = new Date(startDate.getFullYear() - 1, startDate.getMonth(), 0, 23, 59, 59);

    let inumber = 1;
    let pad = "0000000";
    let starts = _now.getFullYear() + ("00" + (_now.getMonth() + 1)).slice(-2);

    Invoices.remove({ number: { $regex: "^" + starts }});

    //get stats for this period of time and update
    stats.date = endDate;

    let defaultbill = Pricing.findOne({"type.default":true});

    const lbs = Labs.find();
    lbs.forEach((l: any) => {

        let lab_invoice: any = {};
        let _invoices: any = {};
        let _tobil;
        let _prules;
        let subscr = {};
        let subscriptionprice = 0;
        let _subscrinfo;
        let inumbers = _now.getFullYear() + ("00" + (_now.getMonth() + 1)).slice(-2) + (pad + (inumber++)).slice(-pad.length);
        let _bill = Billing.findOne({"laboratoryId": l["_id"], "active":true});

        //Not all labs has owner yet!
        //get billing by laboratory_id

        _prules = defaultbill;

        if(!_bill) {
            _tobil = {
                _id: Random.id(),
                type: 1,
                name: 'Default billing',
                bu: 0, fund: 0, dep: 0, acc: 0, prj: 0, br: 0, pcbu: 0, acode: 0
            };
        } else {
            _tobil = _bill['account'];
            if(_bill['subscription']){
                _prules = _bill['subscription']['plan'];
                _subscrinfo = _prules.name;
                if(_bill['subscription']['startDate'] > startDate && _bill['subscription']['startDate'] < endDate) {
                    subscriptionprice = _prules.rules[0].price.v*1;
                }
            }
        }

        lab_invoice['number'] = inumbers;
        lab_invoice['to'] = { lab: l, billing: _tobil };
        lab_invoice['from'] = {billing: Meteor.settings["billing"]};

        lab_invoice['invoice'] = [];
        lab_invoice['paid'] = false;
        lab_invoice['total'] = {
            transactions: 0,
            newtransactions: 0,
            size: 0,
            cputime: 0,
            newcputime: 0,
            subscription: {
                name:_subscrinfo,
                price: subscriptionprice*1  //  Why do we need this *1?
            },
            price:subscriptionprice*1
        };

        lab_invoice['issued'] = endDate; //check if this invoice already exists

        let labProjectIds = Projects.find(
            {
                "labs": {
                    $elemMatch: {
                        $and: [ {"_id": l._id}, {"main": true} ]
                    }
                }
            }).map((project:any) => {return project._id});

        let ex = Samples.find(
            {"projectId": {$in: labProjectIds}},
            {sort: {"stats.dateanalyzed": 1}});

        ex.forEach((e: any)=>{

            //TODO: put in separate function that goes trough all experiments
            let expSize = FilesUpload.find({"meta.sampleId": e._id}).map(f => {return f.size}).reduce((a,b) => a + b, 0);
            stats.storage += expSize;
            stats.experiments++;

            let _datea = new Date(e.date.analyzed);

            let price = ruleWorkflow(_datea, endDate, _prules, defaultbill, Invoices, e['_id'], subscr);

            let main_lab = l._id;


            if(!_invoices[e.projectId]) //sub categories
                _invoices[e.projectId] = {
                    project:{
                        _id: e.projectId,
                        // name: prj['name'],
                        // description:  prj['description'],
                        // labs: prj['labs'],
                        mlab: main_lab,
                        total: {
                            transactions: 0,
                            size: 0,
                            cputime: 0,
                            price: 0
                        }
                    },
                    transactions:[]
                };
            //sub category transactions
            _invoices[e.projectId].transactions.push({
                _id: e['_id'],
                analyzed: _datea,
                author: e['author'],
                name: e.metadata.alias,
                size: expSize,
                cputime: (new Date(e.date.analyse_end) - new Date(e.date.analyse_start))*1,
                price: price
            });
            _invoices[e.projectId].project.total.size += expSize*1;
            _invoices[e.projectId].project.total.transactions++;
            _invoices[e.projectId].project.total.price += price*1;
            _invoices[e.projectId].project.total.cputime += (new Date(e.date.analyse_end) - new Date(e.date.analyse_start))*1;
            lab_invoice['total'].transactions++;
            lab_invoice['total'].size += expSize*1;
            lab_invoice['total'].price += price*1;
            lab_invoice['total'].cputime += (new Date(e.date.analyse_end) - new Date(e.date.analyse_start))*1;

            //TODO: put in separate function that goes trough all experiments
            if(_datea > startDate && _datea < endDate) {
                lab_invoice['total'].newcputime += (new Date(e.date.analyse_end) - new Date(e.date.analyse_start))*1;
                lab_invoice['total'].newtransactions ++;
                stats.newexperiments ++;
                stats.cputime += (new Date(e.date.analyse_end) - new Date(e.date.analyse_start));
            }


        });
        if(_.keys(_invoices).length > 0) {
            _.keys(_invoices).forEach((k) => {
                lab_invoice['invoice'].push(_invoices[k]);
            });
            Invoices.insert(lab_invoice);
        }
    });
    return of(1);
}


Meteor.methods({

    "invoices/create": function (date) {
        if (!this.userId){
            throw new Meteor.Error(403, 'User not found');
        }
        Log.debug("Create invoice for", date);
        getInvoices(new Date(date));
    }

});