use std::cmp::min;

use wasm_bindgen::prelude::*;
use web_sys::ImageData;

#[wasm_bindgen]
pub async fn remove_background(
    in_ctx: web_sys::CanvasRenderingContext2d,
    out_ctx: web_sys::CanvasRenderingContext2d,
    w: f64,
    h: f64,
) -> Result<(), JsValue> {
    let frame = in_ctx.get_image_data(0.0, 0.0, w, h).unwrap();
    let mut data = frame.data();
    for color in data.chunks_exact_mut(4) {
        if color[0] == 255 && color[1] == 255 && color[2] == 255 {
            color[3] = 0; // Make transparent
            continue;
        }
        if color[0] < 127 || color[1] < 127 || color[2] < 127 {
            continue;
        }
        color[3] = 255 - min(color[0], min(color[1], color[2]));
    }
    let new_data = ImageData::new_with_u8_clamped_array_and_sh(
        wasm_bindgen::Clamped(data.as_slice()),
        frame.width(),
        frame.height(),
    )?;
    out_ctx.put_image_data(&new_data, 0.0, 0.0)?;
    Ok(())
}
