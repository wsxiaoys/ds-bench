routerUse((e) => {
    const path = e.request.url.path;
    const method = e.request.method;
    console.log("Request received:", method, path);
    return e.next();
});
