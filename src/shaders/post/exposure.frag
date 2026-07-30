// Camera exposure.
//
// Everything upstream of this point is in physical units: the sky is thousands of candela per
// square metre at noon and hundredths at night, a range of about ten million to one. This is
// the aperture. It runs *before* tone mapping and before bloom, so the bloom threshold can be
// stated in the units that make sense after exposure — "brighter than diffuse white" — rather
// than in absolute nits, which would mean the threshold had to change with the time of day.
//
// The value comes from `world/Sky.ts`, which derives it from scene illuminance through the
// standard Saturation-Based Sensitivity relation and then adapts it slowly. There is no
// artist-authored exposure curve.

uniform float exposure;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}
