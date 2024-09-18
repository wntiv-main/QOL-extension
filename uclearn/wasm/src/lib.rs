use std::iter::zip;

use js_sys::JsString;
use once_cell::sync::Lazy;
use regex::Regex;

use wasm_bindgen::prelude::*;

static CM_ICONS_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?m)^(\s*)if.*hascourseindexcmicons(?:.|\n)*?^\1}\s*;?").unwrap_throw());

static REQUIRES_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?m)^(\s*)require\(\[?(.*?)\]?,\s*function\s*\((.*)\)\s*{((?:.|\n)*?)^\1}\s*\)\s*;?",
    )
    .unwrap_throw()
});

static CLEAN_JS_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?m)^[\s\n;]*|^\s*//.*$").unwrap_throw());

#[wasm_bindgen]
pub async fn optimise_js(js: JsString, icons_js: js_sys::JsString) -> Result<JsString, JsValue> {
    let js_src = js.as_string().unwrap_throw();
    let rest_js = CM_ICONS_RX.replace_all(&js_src, "");
    let mut final_deps: Vec<&str> = vec![];
    let mut contents = String::new();
    let mut count = 0;
    for (_, [_ws, deps_str, args_str, content]) in
        REQUIRES_RX.captures_iter(&rest_js).map(|c| c.extract())
    {
        let args = args_str.split(",").map(|arg| arg.trim());
        let deps = deps_str
            .split(",")
            .map(|dep| dep.trim_matches(&[' ', '\t', '\n', '\r', '\'', '"']));
        for (arg, dep) in zip(args, deps) {
            let arg_id: usize;
            if final_deps.iter().any(|x| *x == dep) {
                arg_id = final_deps.iter().position(|x| *x == dep).unwrap_throw();
            } else {
                arg_id = final_deps.len();
                final_deps.push(dep);
            }
            let owned_content = Regex::new(&(r"\b".to_owned() + arg + r"\b"))
                .unwrap_throw()
                .replace_all(content, "__".to_owned() + &arg_id.to_string());
            contents += &owned_content;
            count += 1;
            if count > 16 {
                count = 0;
                contents += ";await new Promise(r => setTimeout(r, 0));";
            }
        }
    }
    let require_js = format!(
        "require([{}], async ({}) => {{{}}});",
        final_deps
            .iter()
            .fold(String::new(), |a, b| a + "," + &format!("\"{}\"", b))
            .strip_prefix(',')
            .unwrap_throw(),
        final_deps
            .iter()
            .enumerate()
            .fold(String::new(), |a, (i, _el)| a + "__" + &i.to_string())
            .strip_prefix(',')
            .unwrap_throw(),
        contents
    );
    let excess_js = REQUIRES_RX.replace_all(&rest_js, "");
    Ok(JsString::from(CLEAN_JS_RX.replace_all(&format!(
        "const __start = performance.now();{}{}{};console.log('courseindex took', performance.now() - __start);",
        icons_js,
        require_js,
        excess_js), "").into_owned()))
}
