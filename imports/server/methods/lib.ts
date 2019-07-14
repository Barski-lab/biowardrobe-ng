export function makeUpdateObject(obj:Object, uo?:Object, key?:string):Object {
    if(!key) key = "";
    uo = uo||{};

    let _key:string = "";
    if(key != "")
        _key = key+".";

    for(let k in obj) {
        key = _key + k;
        check(k, String);
        if (typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
            makeUpdateObject(obj[k], uo, key)
        } else {
            if (Array.isArray(obj[k])) {
                check(obj[k], [String]);
                uo[key] = Array.from(new Set(obj[k]));
            } else {
                check(obj[k], Match.OneOf(String, Number, Boolean));
                uo[key] = obj[k];
            }
        }
    }
    return uo;
}
