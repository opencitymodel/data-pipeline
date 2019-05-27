import json
import osmium
import sys

geojson = osmium.geom.GeoJSONFactory()

class BuildingHandler(osmium.SimpleHandler):
    def __init__(self):
        osmium.SimpleHandler.__init__(self)
        self.bldgs = set()

    def area(self, area):
        if 'building' in area.tags and not area.is_multipolygon():
            try:
                geometry = geojson.create_multipolygon(area)

                feature = {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': json.loads(geometry)
                }

                # look for height
                if 'height' in area.tags:
                    feature['properties']['height'] = area.tags['height']

                self.bldgs.add(json.dumps(feature))
            except:
                print(f'skipping area {area.id}')

if __name__ == '__main__':

    filename = sys.argv[1]
    state = sys.argv[2]

    h = BuildingHandler()

    h.apply_file(filename, locations=True)

    # we need to remove ways which are part of a relation
    f = open(f"{state}.txt","w+")
    for bldg in h.bldgs:
        f.write(f'{bldg}\n')
    f.close()

    print(f"Buildings: {len(h.bldgs)}")
