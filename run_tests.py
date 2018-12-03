#!/usr/bin/env python
if __name__ == '__main__':
    import coverage
    cov = coverage.Coverage()

    cov.start()
    import sys
    import pytest
    ret = pytest.main(sys.argv[1:])
    cov.stop()

    cov.save()
    cov.report()
    sys.exit(ret)
