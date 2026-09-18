// A real Jest suite with one passing and one failing test, so the smoke job
// exercises the argument assembly, the results file and the outputs against
// Jest itself rather than against a stand-in that writes the file directly.
test('adds', () => {
  expect(1 + 1).toBe(2);
});

test('fails on purpose, so the report has something to carry', () => {
  expect(1 + 1).toBe(3);
});
