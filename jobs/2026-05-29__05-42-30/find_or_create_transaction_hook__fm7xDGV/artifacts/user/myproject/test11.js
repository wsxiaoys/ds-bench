async function test() {
  try {
    try {
      throw new Error("Original error");
    } finally {
      throw new Error("Finally error");
    }
  } catch(e) {
    console.log(e.message);
  }
}
test();
