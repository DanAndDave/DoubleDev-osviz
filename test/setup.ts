// Ink's colour support is detected when it is first imported; the test stdout is not a TTY, so
// without this every frame would be plain text and bold, dim and inverse could not be asserted.
process.env.FORCE_COLOR = "1";
