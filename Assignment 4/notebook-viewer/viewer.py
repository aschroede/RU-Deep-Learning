#
# Side-by-side viewer for assignment notebooks and score sheets.
#
#  1. Collect the notebooks that you want to open in a directory.
#     For example: extract the Brightspace .zip file and copy the .html score form.
#     The viewer can look inside subdirectories.
#
#     Use the --zip option to load files directly from a Brightspace .zip file.
#     The score files can still be loaded from the current directory.
#
#  2. Run this viewer server in the directory containing the notebooks and score sheet.
#     python assignments/viewer/viewer.py
#
#  3. Go to http://127.0.0.1:8000/
#
#  4. Select two files to open.
#     Be careful: save your work before you reload.
#
#     In the score sheet, use Tab to jump between questions and c to add a comment.
#
import argparse
import contextlib
import glob
import io
import json
import os.path
import re
import zipfile

import bottle
import nbconvert

import fix_notebooks

parser = argparse.ArgumentParser(description='Side-by-side viewer for assignment notebooks.')
parser.add_argument('--path', metavar='PATH', type=str, default='.',
                    help='where to look for notebook files (.ipynb and .html) (default: current path)')
parser.add_argument('--zip', metavar='ZIPFILE', type=str, default=None,
                    help='look inside a Brightspace .zip file')
parser.add_argument('--host', metavar='IP', type=str, default='localhost',
                    help='start a server listening on this address (default: all)')
parser.add_argument('--port', metavar='PORT', type=int, default=8000,
                    help='start a server listening on this port (default: 8000)')
args = parser.parse_args()


GLOBS = [
    '**/*.html',
    '**/*.ipynb',
]
TEMPLATE_DIR = os.path.dirname(__file__)
bottle.TEMPLATE_PATH.insert(0, TEMPLATE_DIR)

# enable the debugging mode to get more useful error messages
# (e.g., if the notebook could not be opened)
bottle.debug(True)

@bottle.hook('after_request')
def disable_cache():
    bottle.response.set_header('Cache-Control', 'private, no-cache')

def is_score_sheet(filename):
    return filename.endswith('-score.html')

def sort_filenames_key(filename):
    # place score sheet first
    if is_score_sheet(filename):
        print(f'found score sheet: {filename}')
        return ' ' + filename
    # if the filename includes Brightspace folder names, sort by group number
    m = re.match('/.+Group ([0-9]+)/', filename)
    if m:
        return 'group %03d %s' % (int(m[1]), filename)
    else:
        return filename

def list_files():
    all_files = {}

    # look in args.path
    files = []
    for gl in GLOBS:
        files += glob.glob(gl, root_dir=args.path, recursive=True)
    friendly_path = 'Current path' if args.path == '.' else args.path
    if len(files) > 0:
        all_files[friendly_path] = sorted(files, key=sort_filenames_key)

    # look in zip
    if args.zip:
        files = []
        with zipfile.ZipFile(args.zip, 'r') as z:
            for file_info in z.infolist():
                if re.match('^.+[.](ipynb|html)$', file_info.filename):
                    files.append(file_info.filename)
        if len(files) > 0:
            all_files['ZIP: %s' % args.zip] = sorted(files, key=sort_filenames_key)

    return all_files

@contextlib.contextmanager
def find_and_open_file(filename):
    if args.zip:
        with zipfile.ZipFile(args.zip, 'r') as z:
            if filename in z.namelist():
                with z.open(filename, 'r') as f:
                    yield f
                    return

    if os.path.exists(os.path.join(args.path, filename)):
        with open(os.path.join(args.path, filename), 'r') as f:
            yield f
            return

    raise bottle.HTTPError(code=404, output='File not found')


# main index page
@bottle.get('/')
def index():
    files = list_files()
    return bottle.template('twoframes.html', files=files)

# resources
@bottle.get('/<filepath:re:.*[.](js|css)>')
def serve_static(filepath):
    response = bottle.static_file(filepath, root=TEMPLATE_DIR)
    response.set_header('Cache-Control', 'private, no-cache')
    return response


# load HTML notebooks
@bottle.get('/<filepath:re:.*[.]html>')
def serve_html(filepath):
    bottle.response.set_header('Cache-Control', 'private, no-cache')
    with find_and_open_file(filepath) as f:
        return f.read()

# load and render .ipynb notebooks
@bottle.get('/<filepath:re:.*[.]ipynb>')
def serve_notebook(filepath):
    with find_and_open_file(filepath) as f:
        return fix_notebooks.convert_to_html(f)


print()
print('  +------------------------------------------------+')
print('  | Side-by-side notebook viewer                   |')
print('  +------------------------------------------------+')
print('  | Listening on %-32s  |' % ('http://%s:%d/' % (args.host, args.port)))
print('  +------------------------------------------------+')
print()

bottle.run(host=args.host, port=args.port)

