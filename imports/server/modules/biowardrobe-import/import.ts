import { Meteor } from 'meteor/meteor';
import { DDPConnection } from '../ddpconnection';

import {
    BioWardrobeMySQL,
    get_experiments,
    get_laboratories,
    get_egroupr,
    get_egroups,
    get_genome,
    get_workers,
    get_antibodies
} from './biowardrobemysql';

import { Log } from '../logger';
import { switchMap, filter, take, catchError, concatAll, mergeAll} from 'rxjs/operators';
import { of } from 'rxjs/observable/of';


import { Labs } from '../../../collections/shared';

// delete Package.webapp.main;

let labs = new Mongo.Collection('biowardrobe_import_labs');
// let billingc = new Mongo.Collection('biowardrobe_import_billing');
// let pricingc = new Mongo.Collection('biowardrobe_import_pricing');
let projects = new Mongo.Collection('biowardrobe_import_projects');
let experiments = new Mongo.Collection('biowardrobe_import_experiments');
// let invoices = new Mongo.Collection('biowardrobe_import_invoices');
let genome = new Mongo.Collection('biowardrobe_import_genome');
let antibodies = new Mongo.Collection('biowardrobe_import_antibodies');
let companyc = new Mongo.Collection('companies');

let statsc = new Mongo.Collection('stats');

// import { map } from 'rxjs/operator/map';
// import { forkJoin } from 'rxjs/observable/forkJoin';
// import { zip } from 'rxjs/observable/zip';
// import { concat } from 'rxjs/observable/concat';
// import { mergeMap } from 'rxjs/operator/mergeMap';


let _laboratories = {};
let genomes = {};
let antibody = {};
let company;

function lab_basic(id, prim=false) {
    let l = _laboratories[id];
    return {
        _id: l._id,
        name: l.name,
        main: prim
    };
}


const stats = {
    storage: 0,
    cputime: 0,
    users: 0,
    experiments: 0,
    newexperiments: 0,
    date: 0
};


Meteor.startup( () => {

    // Labs._dropIndex({ "owner._id": 1} );
    // Labs._dropIndex({ "biowardrobe_import.laboratory_id": 1} );
    // Meteor.users._dropIndex({ "biowardrobe_import.laboratory_id": 1});

    Labs._ensureIndex({ "owner._id": 1}, { unique: true } );
    Labs._ensureIndex({ "biowardrobe_import.laboratory_id": 1} );
    Meteor.users._ensureIndex({ "biowardrobe_import.laboratory_id": 1} );

    of(
        DDPConnection.sync$
            .pipe(
                filter(_ => !!_),
                take(1),
            ),
        BioWardrobeMySQL.getWorkers(Meteor.settings["oauth2server"]["domain"])
            .pipe(
                switchMap( (ws) => {
                        let _obs = [of([])];

                        _.each(ws[0], (w) => {

                            let email = w['email'].toLowerCase();
                            if (!email || email.length === 0) return;
                            if (!email.endsWith(Meteor.settings["oauth2server"]["domain"])) return;

                            if (!Meteor.users.findOne({'emails.address': email})) {
                                Log.debug('Call createUser', w['fname'], w['lname'], email);
                                _obs.push(DDPConnection.call('satellite/accounts/createUser', w['fname'], w['lname'], email))
                            }
                        });

                        return of(..._obs);
                    }
                ),
                mergeAll(),
                catchError((e) => of({error: true, message: `Create user: ${e}`}))
            ),
        BioWardrobeMySQL.getWorkers(Meteor.settings["oauth2server"]["domain"])
            .pipe(
                switchMap( (ws) => {

                        _.each(ws[0], (w) => {

                            let email = w['email'].toLowerCase();
                            if (!email || email.length === 0) return;
                            if (!email.endsWith(Meteor.settings["oauth2server"]["domain"])) return;
                            const user = Meteor.users.findOne({'emails.address': email});
                            if (!user) {
                                Log.Error('Must be in the list already', w['fname'], w['lname'], email);
                            }

                            Meteor.users.update({_id: user._id}, {
                                $set: {
                                    biowardrobe_import: {
                                        laboratory_id: w['laboratory_id'],
                                        admin: w['admin'],
                                        laboratory_owner: w['changepass']
                                    }
                                }})
                        });

                        return of([]);
                    }
                ),
                catchError((e) => of({error: true, message: `Update users: ${e}`}))
            ),
        BioWardrobeMySQL.getLaboratories()
            .pipe(
                switchMap( (ls) => {
                        let _obs = [of([])];

                        _.each(ls[0], (l) => {
                            const user = Meteor.users.findOne(
                                { $and:[
                                        {'biowardrobe_import.laboratory_id': l.id},
                                        {'biowardrobe_import.laboratory_owner':1}
                                    ]
                                });
                            if (!user) { return; }

                            const lab = Labs.findOne({"owner._id": user._id});
                            if(!lab) {
                                Log.debug('Add lab:', user, l.name);
                                _obs.push(DDPConnection.call('satellite/accounts/createLab', user._id, l.name, l.description));
                            }
                        });
                        return of(..._obs);
                    }
                ),
                mergeAll(),
                catchError((e) => of({error: true, message: `Create laboratory: ${e}`}))
            ),
        BioWardrobeMySQL.getLaboratories()
            .pipe(
                switchMap( (ls) => {
                    _.each(ls[0], (l) => {
                        const user = Meteor.users.findOne(
                            { $and:[
                                    {'biowardrobe_import.laboratory_id': l.id},
                                    {'biowardrobe_import.laboratory_owner':1}
                                ]
                            });
                        if (!user) { return; }

                        const lab: any = Labs.findOne({"owner._id": user._id});
                        if(!lab) {
                            Log.Error('Must be in the list already', user);
                        }
                        Labs.update({_id: lab._id}, {
                            $set: {
                                biowardrobe_import: {
                                    laboratory_id: l.id
                                }
                            }})

                    });
                    return of([])
                })
            )

    )
        .pipe(concatAll())
        .subscribe((c) => {
            if (c) {
                Log.debug("Sync stream, subscribed!", c);
            }
        });
});

// function biowardrobe_import() {
//
//     company = companyc.findOne({_id:"DYgNbu68C7PYMZLpc"}); //CCHMC
//
//     return get_laboratories()
//         .then((rs) => {
//             _.each(rs, (r) =>  {
//                 let l = labs.findOne({"id": r['id']});
//                 if (!l) {
//                     r['_id'] = labs.insert(r);
//                 } else {
//                     r['_id'] = l._id;
//                 }
//                 _laboratories[r.id] = r;
//             });
//             return get_egroups();
//         })
//         /**
//          *   Copy egroups as Projects and assign labs to it
//          */
//         .then((es) => {
//             _.each(es, (e) => {
//                 let p = projects.findOne({id: e.id});
//
//                 e["labs"] = [];
//                 e["labs"].push(lab_basic(e.laboratory_id, true));
//                 // e["laboratory_id"] = _laboratories[e.laboratory_id]._id;
//                 e['description'] = {
//                     description: e['description'] == null ? '' : e['description'],
//                     name: e['name']
//                 };
//
//                 e = _.omit(e,['laboratory_id', 'name']);
//
//                 if (!p) {
//                     projects.insert(e);
//                 } else {
//                     projects.update({id: e.id},e);
//                 }
//             });
//             return get_egroupr(); //get egroup rights
//
//             /**
//              *   Based on egroups Rights assign new Labs to the Project
//              */
//         }).then((es) => {
//             _.each(es, (e) => {
//                 let p = projects.findOne({id: e.egroup_id},
//                     { //Glitch :/
//                         fields: {
//                             _id: 1,
//                             description: 1,
//                             labs: 1
//                         }
//                     });
//                 if (!p) {
//                     console.log("Error?:", e); //has to exist
//                 } else {
//                     projects.update({id: e.egroup_id}, {
//                         $addToSet: {labs: lab_basic(e.laboratory_id)}
//                     });
//                 }
//             });
//             return get_workers();
//             /**
//              *   Copy Workers
//              */
//         }).then((es) => {
//             _.each(es, (w) => {
//
//                 let email = w['email'].toLowerCase();
//                 if (!email || email.length === 0) return;
//                 if (!email.endsWith(Meteor.settings["oauth2server"]["domain"])) return;
//
//                 const user = Meteor.users.findOne({'emails.address': email});
//
//                 stats.users ++;
//
//                 let userId;
//                 let firstName;
//                 let lastName;
//
//                 if(user) {
//                     userId = user._id;
//                     firstName = user.profile['firstName'];
//                     lastName = user.profile['lastName'];
//                 } else {
//                     firstName = w['fname'];
//                     lastName = w['lname'];
//
//                     Log.debug('Call createUser', firstName, lastName, email);
//                     DDPConnection.call('satellite/accounts/createUser',firstName, lastName, email).subscribe( (userId) => {
//                         Log.debug('Subscribe createUser', email, userId)
//                     });
//                 }
//
//                 if(w['laboratory_id']) {
//
//                     let _l = _.omit(lab_basic(w['laboratory_id']), 'main');
//                     if (w['changepass'] === 1) {
//                         //         labs.update({id: w['laboratory_id']}, {
//                         //             $set: {
//                         //                 "owner": {
//                         //                     _id: userId,
//                         //                     lastName: lastName,
//                         //                     firstName: firstName
//                         //                 }
//                         //             }
//                         //         });
//                         //         Roles.setUserRoles(userId, ['owner'], _laboratories[w['laboratory_id']]._id );
//                     }
//                     // else {
//                     //
//                     //         //TODO: NB addToSet will or will not check by ID or by the whole structure, I can garantee uniqness of _ID only;
//                     //         labs.update({id: w['laboratory_id']}, {
//                     //             $addToSet: {
//                     //                 "members": {
//                     //                     _id: userId,
//                     //                     lastName: lastName,
//                     //                     firstName: firstName
//                     //                 }
//                     //             }
//                     //         });
//                     //         Roles.setUserRoles(userId, ['technician'], _laboratories[w['laboratory_id']]._id );
//                     //     }
//                 }
//
//             });
//             return get_genome();
//
//             /**
//              *   Copy Genome Table
//              */
//         }).then((gs) => {
//             _.each(gs, (g) => {
//                 let p = genome.findOne({id: g.id});
//                 if(!p) {
//                     g["_id"] = genome.insert(g);
//                     genomes[g.id] = g;
//                 } else {
//                     genomes[g.id] = p;
//                 }
//             });
//             return get_antibodies();
//
//             /**
//              *   Copy Antibodies Table
//              */
//         }).then((gs) => {
//             _.each(gs, (g) => {
//                 let p = antibodies.findOne({id: g.id});
//                 if(!p) {
//                     g["_id"] = antibodies.insert(g);
//                     antibody[g.id] = g;
//                 } else {
//                     antibody[g.id] = p;
//                 }
//             });
//             return get_experiments();
//             /**
//              *   Copy Experiments
//              */
//         });
//
//     /**
//      *  TODO: stop here for now!
//      */
//
//
//     //     .then((es) => {
//     //         _.each(es, (e) => {
//     //             let p = projects.findOne({id: e.egroup_id});
//     //             let ex = experiments.findOne({uid: e.uid});
//     //             if (!p) {
//     //                 console.log("Error?:", e); //has to exist
//     //             } else {
//     //                 let _anti = {};
//     //                 if(antibody[e['antibody_id']]) {
//     //                     _anti = {
//     //                         name: antibody[e['antibody_id']].antibody,
//     //                         type: antibody[e['antibody_id']].properties==2?"broad":antibody[e['antibody_id']].properties==1?"narrow":null
//     //                     };
//     //                 } else {
//     //                     _anti = {
//     //                         name: "N/A",
//     //                         type: null
//     //                     };
//     //                 }
//     //
//     //                 e['antibody'] = _anti;
//     //
//     //                 e['stats'] = {
//     //                     dateadd:e['dateadd'],
//     //                     datedel:e['datedel'],
//     //                     dateanalyzed:e['dateanalyzed'],
//     //                     analysisstart:e['dateanalyzes'],
//     //                     analysisend:e['dateanalyzee'],
//     //                     minutes: (Math.abs(new Date(e['dateanalyzee']) - new Date(e['dateanalyzes']))/1000)/60,
//     //                     size: e['size']
//     //                 };
//     //                 e['number'] = e['id'];
//     //                 e['projects'] = [p];
//     //                 // e['projects'].push(p);
//     //                 e['genome'] = _.omit(genomes[e['genome_id']],'id');
//     //                 e['results'] = {
//     //                     tagstotal: e['tagstotal'],
//     //                     tagsmapped:e['tagsmapped'],
//     //                     tagssuppressed:e['tagssuppressed'],
//     //                     tagsused:e['tagsused'],
//     //                     tagsribo:e['tagsribo'],
//     //                     islandcount:e['islandcount']
//     //                 };
//     //                 if(company.tech && company.tech.public_url){
//     //                     e['results']['public_url'] = company.tech.public_url;
//     //                 }
//     //                 e['experimenttype'] = experimentType[e['experimenttype_id']];
//     //
//     //                 e = _.omit(e, ['id','tagstotal','tagsmapped','tagssuppressed','tagsused','tagsribo','islandcount','experimenttype_id','genome_id','laboratory_id','antibody_id',
//     //                     'dateadd','datedel','dateanalyzed','dateanalyzes','dateanalyzee','size']);
//     //                 if(!ex) {
//     //                     experiments.insert(e);
//     //                 } else {
//     //                     experiments.update({uid: e.uid},e);
//     //                 }
//     //             }
//     //         });
//     //     }).then(()=>{
//     //         //do invoice & stats
//     //         let _now = new Date(2016,11,16); // new Date(); new Date(2016,5,16);
//     //
//     //         let startDate = new Date(_now.getFullYear(), _now.getMonth()-1, 1,0,0,0);
//     //         let endDate = new Date(_now.getFullYear(), _now.getMonth(), 0,23,59,59);
//     //         let yearAGo = new Date(startDate.getFullYear()-1,startDate.getMonth(), 0,23,59,59)
//     //
//     //         let dayx = new Date(2016,3,1);//Month goes from 0 !!!
//     //
//     //         let inumber = 1;
//     //         let pad = "0000000";
//     //         let starts=_now.getFullYear()+("00"+(_now.getMonth()+1)).slice(-2);
//     //
//     //         invoices.remove({ number: { $regex: "^"+starts }});
//     //         //get stats for this period of time and update
//     //         stats.date = endDate;
//     //
//     //         let defaultbill = pricingc.findOne({"type.default":true});
//     //         //Create an invoice for each lab
//     //         //go trough laboratories
//     //         //get laboratory/user_id subscription/s
//     //         let lbs = labs.find();
//     //         lbs.forEach((l) => {
//     //
//     //             let lab_invoice = {};
//     //             let _invoices = {};
//     //             let _tobil;
//     //             let _prules;
//     //             let subscr = {};
//     //             let subscriptionprice = 0;
//     //             let _subscrinfo;
//     //             let inambers = _now.getFullYear()+("00"+(_now.getMonth()+1)).slice(-2)+(pad+(inumber++)).slice(-pad.length);
//     //             let _bill = billingc.findOne({"laboratoryId":l["_id"], "active":true});
//     //             //Not all labs has owner yet!
//     //             //get billing by laboratory_id
//     //
//     //             _prules = defaultbill;
//     //
//     //             if(!_bill) {
//     //                 _tobil = {
//     //                     _id: Random.id(),
//     //                     type: 1,
//     //                     name: 'Default billing',
//     //                     bu: 0, fund: 0, dep: 0, acc: 0, prj: 0, br: 0, pcbu: 0, acode: 0
//     //                 };
//     //             } else {
//     //                 _tobil = _bill['account'];
//     //                 if(_bill['subscription']){
//     //                     _prules = _bill['subscription']['plan'];
//     //                     _subscrinfo = _prules.name;
//     //                     if(_bill['subscription']['startDate'] > startDate && _bill['subscription']['startDate'] < endDate) {
//     //                         subscriptionprice = _prules.rules[0].price.v*1;
//     //                     }
//     //                 }
//     //             }
//     //
//     //             lab_invoice['number'] = inambers;
//     //             lab_invoice['to'] = { lab: l, billing: _tobil };
//     //             lab_invoice['from'] = { billing: company['billing'], info: _.omit(company['public'],["web","description"])};
//     //             lab_invoice['invoice'] = [];
//     //             lab_invoice['paid'] = false;
//     //             lab_invoice['status'] = {'paid':false };
//     //             lab_invoice['total'] = {
//     //                 transactions: 0,
//     //                 newtransactions: 0,
//     //                 size: 0,
//     //                 cputime: 0,
//     //                 newcputime: 0,
//     //                 subscription: {
//     //                     name:_subscrinfo,
//     //                     price: subscriptionprice*1
//     //                 },
//     //                 price:subscriptionprice*1
//     //             };
//     //
//     //             lab_invoice['issued'] = endDate;//check if this invoice already exists
//     //
//     //             let ex = experiments.find({"projects.labs":{$elemMatch: {"_id":l._id,"main": true}}},{sort: {"stats.dateanalyzed": 1}});
//     //             ex.forEach((e)=>{
//     //
//     //                 let prj = e['projects'][0];
//     //                 if(prj['labs'].length > 3)
//     //                     return;
//     //
//     //                 if(e['libstatus'] < 12 || e['libstatus'] > 21 )
//     //                     return;
//     //
//     //                 /*TODO: in a future check size also?*/
//     //                 if(!e['stats']['dateanalyzed'])
//     //                     return;
//     //
//     //                 //TODO: put in separate function that goes trough all experiments
//     //                 stats.storage += e['stats']['size'];
//     //                 stats.experiments ++;
//     //
//     //                 /* I hate this date stuf, I'm getting rid of all records where analysis date after endDate*/
//     //                 let _datea = new Date(e['stats']['dateanalyzed']);
//     //                 if(_datea > endDate) {
//     //                     // console.log("  S",startDate);
//     //                     // console.log("  E",endDate);
//     //                     // console.log("  B",(_datea > endDate));
//     //                     return;
//     //                 }
//     //
//     //                 /*TODO: Will be deleted in a month*/
//     //                 if(e['stats']['datedel']) {
//     //                     let datedel = new Date(e['stats']['datedel']);
//     //                     if (datedel < dayx || datedel < startDate || _datea.getFullYear()<datedel.getFullYear()) // TODO: dateDel < year ago !!!
//     //                         return;
//     //                 }
//     //
//     //                 let _fake_datea = _datea;
//     //                 //Special occasion before we run as usual, everything with the age less then a year equal 10$
//     //                 if( _datea < dayx && dayx > yearAGo) { // If experiment is older then dayX and dayX within a year then we count all the records as old
//     //                     _fake_datea = Diff(yearAGo,1,"d");
//     //                 }
//     //
//     //                 // let rule = getRule(_fake_datea,endDate,_prules);
//     //                 // //TODO: this if actully will work when this script will be run more often then once a month
//     //                 // let exclude = getExclude(endDate,rule,invoices,e['_id']);
//     //                 // if(exclude.count() > 0) {
//     //                 //     // console.log("  S",startDate);
//     //                 //     // console.log("  E",endDate);
//     //                 //     // console.log("  A",_datea);
//     //                 //     // console.log("  ",rule);
//     //                 //     // console.log("  ",Diff(endDate,1,rule.charge.t));
//     //                 //     // console.log("  ",exclude.fetch());
//     //                 //     // console.log("---");
//     //                 //     return;
//     //                 // }
//     //
//     //                 // let price = getPeriodPrice(rule);
//     //
//     //                 let price = ruleWorkflow(_fake_datea,endDate,_prules,defaultbill,invoices,e['_id'],subscr);
//     //
//     //                 let main_lab = _.find(prj['labs'],(a)=> a['main'] == true );
//     //
//     //
//     //                 if(!_invoices[prj._id]) //sub categories
//     //                     _invoices[prj._id] = {
//     //                         project:{
//     //                             _id: prj['_id'],
//     //                             name: prj['name'],
//     //                             description:  prj['description'],
//     //                             labs: prj['labs'],
//     //                             mlab: main_lab,
//     //                             total: {
//     //                                 transactions: 0,
//     //                                 size: 0,
//     //                                 cputime: 0,
//     //                                 price: 0
//     //                             }
//     //                         },
//     //                         transactions:[]
//     //                     };
//     //                 //sub category transactions
//     //                 _invoices[prj._id].transactions.push({
//     //                     _id: e['_id'],
//     //                     analyzed: _datea,
//     //                     number: e['number'],
//     //                     author: e['author'],
//     //                     name: e['name4browser'],
//     //                     size: e['stats']['size'],
//     //                     cputime: e['stats']['minutes'],
//     //                     price: price
//     //                 });
//     //                 _invoices[prj._id].project.total.size += e['stats']['size']*1;
//     //                 _invoices[prj._id].project.total.transactions ++;
//     //                 _invoices[prj._id].project.total.price += price*1;
//     //                 _invoices[prj._id].project.total.cputime += e['stats']['minutes']*1;
//     //                 lab_invoice['total'].transactions ++;
//     //                 lab_invoice['total'].size += e['stats']['size']*1;
//     //                 lab_invoice['total'].price += price*1;
//     //                 lab_invoice['total'].cputime += e['stats']['minutes']*1;
//     //
//     //                 //TODO: put in separate function that goes trough all experiments
//     //                 if(_datea > startDate && _datea < endDate) {
//     //                     lab_invoice['total'].newcputime += e['stats']['minutes']*1;
//     //                     lab_invoice['total'].newtransactions ++;
//     //                     stats.newexperiments ++;
//     //                     stats.cputime += e['stats']['minutes'];
//     //                 }
//     //
//     //
//     //             });
//     //             /**
//     //              *  Collected all the records from experiments.
//     //              */
//     //             if(_.keys(_invoices).length > 0) {
//     //                 _.keys(_invoices).forEach((k) => {
//     //                     lab_invoice['invoice'].push(_invoices[k]);
//     //                 });
//     //                 invoices.insert(lab_invoice);
//     //                 // console.log(lab_invoice);
//     //             }
//     //         });
//     //         statsc.remove({"date":endDate});
//     //         console.log(stats);
//     //         statsc.insert(stats);
//     //     });
//     // // return 'DAEMON';
//     // return p; //Promise.await(p);
// }
//
//
// /**
//  * Helper functions
//  *
//  *
//  */
// /////
// function GetGravatar(mail) {
//     let options = {
//         secure: true,
//         default: 'monsterid'
//     };
//     let md5Hash = Gravatar.hash(mail);
//     return Gravatar.imageUrl(md5Hash, options);
// }
//
// // "rules": [{
// //         "price": {
// //             "v": "35", "t": "y"
// //         },
// //         "charge": {
// //             "v": "1", "t": "y"
// //         },
// //         "includes": {
// //             "v": null, "t": "y"
// //         }
// //     }, {
// //         "price": {
// //             "v": "10", "t": "y"
// //         },
// //         "charge": {
// //             "v": null, "t": "m"
// //         },
// //         "includes": {
// //             "v": null, "t": "y"
// //         }
// //     }]
//
// // "rules": [{
// //         "price": {
// //             "v": "2800", "t": "y"
// //         },
// //         "charge": {
// //             "v": "1", "t": "y"
// //         },
// //         "includes": {
// //             "v": "100", "t": "i"
// //         }
// //     }, {
// //         "price": {
// //             "v": "0", "t": "y"
// //         },
// //         "charge": {
// //             "v": null, "t": "y"
// //         },
// //         "includes": {
// //             "v": "200", "t": "i"
// //         }
// //     }]
//
// function Diff(d,v,t) {
//     "use strict";
//     let f;
//
//     if(v ==  null)
//         v = 1;
//
//     let _d;
//
//     switch (t) {
//         case "mm":
//             _d = new Date(d.setMinutes(d.getMinutes()-v));
//             f = "getMinutes";
//             break;
//         case "d":
//             _d = new Date(new Date(d).setDate(d.getDate()-v));
//             f = "getDate";
//             break;
//         case "m":
//             let max_date_s = (new Date (d.getFullYear(),d.getMonth()-v+1,0)).getDate();
//             if(d.getDate() == 1) {
//                 _d = new Date(d.getFullYear(), d.getMonth() - v, 1, 0 , 0, 0);
//             } else {
//                 _d = new Date(d.getFullYear(), d.getMonth() - v, max_date_s, 23, 59, 59);
//             }
//             f = "getMonth";
//             break;
//         case "y":
//             _d = new Date(d.getFullYear()-v, d.getMonth(),d.getDate(), d.getHours() , d.getMinutes(), d.getSeconds());
//             f = "getYear";
//             break;
//     }
//
//     return _d; //new Date(d[f]() - v);
// }
//
// function ruleWorkflow(dateA, endDate, billing, dbilling, invs, id, subscr){
//     "use strict";
//
//     let rule = getRule(dateA, endDate, billing);
//     let price = 0;
//     if(!rule[0].includes.v) {//Kind of default rule
//         if(getExclude(endDate,rule[0],invs,id).count() > 0) { // Should be ignored already charged for this rule
//
//         } else { // Should be charged new transaction for this rule.
//             price = getPeriodPrice(rule[0]);
//         }
//     } else {
//         let mamount = (rule[0].includes.v)*1;
//         if(!subscr[rule[1]])
//             subscr[rule[1]] = { ma: mamount, count: 1 };
//
//         if(subscr[rule[1]].count > subscr[rule[1]].ma) { //apply default rule
//             rule = getRule(dateA, endDate, dbilling);
//             if(getExclude(endDate,rule[0],invs,id).count() > 0) { // Should be ignored already charged for this rule
//
//             } else { // Should be charged new transaction for this rule.
//                 price = getPeriodPrice(rule[0]);
//             }
//         } else { // already paid by subscription
//             subscr[rule[1]].count++;
//         }
//     }
//     return price;
// }
//
// function getRule(_datea, endDate, pricing) {
//     "use strict";
//
//     for(let i=0; i < pricing.rules.length; i++){
//         let rule = pricing.rules[i];
//         let s=getApplied(_datea, endDate, rule);
//         if(s[0]) {
//             return [rule,i];
//         }
//     }
//     return null;
// }
//
// function getApplied(_datea,endDate,rule) {
//     "use strict";
//     let s = Diff(endDate,rule.charge.v,rule.charge.t);
//     return [(rule.charge.v==null)||(_datea > s), s];
// }
//
// function getExclude(_d,rule,inv,_id) { //returns number of invoices for the experiment _id
//     return inv.find({
//         $and:[
//             {
//                 "invoice.transactions._id":_id
//             },{
//                 "issued":{$gt:new Date(Diff(_d,1,rule.charge.t)) }
//             }
//         ]});
// }
//
// function getPeriodPrice(rule) { //t comes from applied:{,t:"m"}
//     "use strict";
//
//     if(rule.price.t == rule.charge.t) return rule.price.v;
//
//     let p = rule.price.v;
//
//     switch (rule.price.t) {
//         case "d":
//             p = p*365; //price for a year
//             break;
//         case "m":
//             p = p*12; //price for a year
//             break;
//     }
//
//     switch (rule.charge.t) {
//         case "d":
//             p = (p/365).toFixed(4);
//             break;
//         case "m":
//             p = (p/12).toFixed(4);
//             break;
//     }
//     return p;
// }
