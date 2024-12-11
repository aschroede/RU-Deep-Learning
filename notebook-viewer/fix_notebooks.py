import io
import json
import nbconvert

strategies = []
def strategy(fn):
    strategies.append(fn)


def convert_to_html(file):
    exception = None
    for strategy in strategies:
        try:
            return strategy(file)
        except Exception as e:
            print(e)
            exception = e
        file.seek(0)
    raise exception


@strategy
def _load_with_nbconvert(file):
    html_exporter = nbconvert.HTMLExporter()
    output, _ = html_exporter.from_file(file)
    return output

@strategy
def _load_as_json(file):
    doc = json.load(file)
    sio = io.StringIO(json.dumps(doc))
    html_exporter = nbconvert.HTMLExporter()
    output, _ = html_exporter.from_file(sio)
    return output

@strategy
def _load_as_json_assignment_1(file):
    doc = json.load(file)
    for cell in doc['cells']:
        if cell['cell_type'] == 'markdown':
            cell['source'] = [
                line.replace('![Sigmoid](attachment:sigmoid.png)', '') \
                    .replace('![relu.png](attachment:relu.png)', '')
                for line in cell['source']]

    sio = io.StringIO(json.dumps(doc))
    html_exporter = nbconvert.HTMLExporter()
    output, _ = html_exporter.from_file(sio)
    return output
