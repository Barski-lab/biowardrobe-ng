export function makeUpdateObject(obj:Object, uo?:Object, key?:string):Object {
    if(!key) key = "";
    uo = uo||{};

    let _key:string = "";
    if(key != "")
        _key = key+".";

    for(let k in obj) {
        key = _key + k;
        check(k, String);
        if (_.isObject(obj[k]) && !_.isArray(obj[k])) {
            makeUpdateObject(obj[k], uo, key)
        } else {
            if (_.isArray(obj[k])) {
                check(obj[k], [String]);
                uo[key] = _.unique(obj[k]);
            } else {
                check(obj[k], Match.OneOf(String, Number, Boolean));
                uo[key] = obj[k];
            }
        }
    }
    return uo;
}