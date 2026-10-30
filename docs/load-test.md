# Synthetic load harness

The pilot brief names **500 tours, 5,000 shows and 100 producers**. A public
demo cannot book those tours, so this harness exercises the pure engine at that
shape on a laptop or in CI:

```bash
cd server
PYTHONPATH=. python scripts/load_test.py
```

It creates 500 tour identities and 5,000 dated shows, runs the full check set for
each show with the AERIAL 12 look, and prints the duration. The assertion is
under 60 seconds on the pilot laptop. This is a **harness**, not a production load
test: the HTTP layer, the queue, Postgres and the delivery fan-out are separate
pilot measurements.
