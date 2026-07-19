import os
import sys

# So `from _kit import ...` works under pytest regardless of rootdir.
sys.path.insert(0, os.path.dirname(__file__))
