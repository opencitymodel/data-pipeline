import json
import osmium
import sys

geojson = osmium.geom.GeoJSONFactory()

def is_number(s):
    """ Returns True if string is a number."""
    try:
        float(s)
        return True
    except ValueError:
        return False

class BuildingHandler(osmium.SimpleHandler):
    def __init__(self):
        osmium.SimpleHandler.__init__(self)
        self.bldgs = set()

    def area(self, area):
        # TODO: be a bit more selective so we reduce things that aren't truly buildings
        if 'building' in area.tags and not area.is_multipolygon():
            try:
                geometry = geojson.create_multipolygon(area)

                feature = {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': json.loads(geometry)
                }

                # look for height
                if 'height' in area.tags and is_number(area.tags['height']):
                    osm_height = round(float(area.tags['height']), 2)

                    # NOTE: we assume a height greater than 3k meters is bunk
                    if osm_height > 0 and osm_height < 3000:
                        feature['properties']['height'] = osm_height

                self.bldgs.add(json.dumps(feature))
            except:
                print(f'skipping area {area.id}')

if __name__ == '__main__':

    filename = sys.argv[1]
    state = sys.argv[2]

    h = BuildingHandler()

    # this will process the OSM file and build a list of the footprints
    h.apply_file(filename, locations=True)

    # write out the footprints to a new file
    f = open(f"{state}.txt","w+")
    for bldg in h.bldgs:
        f.write(f'{bldg}\n')
    f.close()

    print(f"Buildings: {len(h.bldgs)}")
