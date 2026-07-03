onRecordCreateRequest((e) => {
    var email = e.record.get("email");
    if (email) {
        var cleanEmail = String(email).trim().toLowerCase();
        e.record.set("email", cleanEmail);
    }
    return e.next();
}, "users");
