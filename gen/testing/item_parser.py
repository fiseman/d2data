import json
from parse import compile as compile_pattern
import time


class ItemParser:
    items: list
    item_lookup: dict = {
        "armor": None,
        "weapons": None,
        "set_items": None,
        "unique_items": None,
        "misc": None,
        "types": None,
    }
    item_lookup_by_display_name: dict = {
        "armor": None,
        "weapons": None,
        "set_items": None,
        "unique_items": None,
        "misc": None,
        "types": None,
    }
    patterns: dict

    def __init__(self):
        start = time.time()

        self.load_items()

        self.load_lookup()

        self.load_parsers()

        end = time.time()
        print(f"Time elapsed to load data: {end - start}")

    def load_items(self):
        with open("test_items.json", "r",encoding = 'utf-8') as f:
            self.items = json.load(f)

    def load_lookup(self):
        for key, value in self.item_lookup.items():
            with open(f"../output/item_{key}.json", "r",encoding = 'utf-8') as f:
                data = json.load(f)

                print(f"Loaded {len(data)} records from item_{key}.json")

                self.item_lookup[key] = data
                self.item_lookup_by_display_name[key] = {value["display_name"]:value for key, value in data.items()}

    def load_parsers(self):
        start = time.time()
        with open("../output/ref_patterns.json", "r",encoding = 'utf-8') as f:
            self.patterns = json.load(f)

        for key, value in self.patterns.items():
            self.patterns[key] = {
                "compiled_pattern": compile_pattern(key),
                "identifiers": value
            }

        end = time.time()
        print(f"Time elapsed to load parsers: {end - start}")

    def find_item_by_display_name(self, name):
        start = time.time()

        matches = {}
        for key, value in self.item_lookup_by_display_name.items():
            if name in self.item_lookup_by_display_name[key]:
                print(f"Found {name} in {key} data!")
                # print(self.item_lookup_by_display_name[key][name])
                matches[key] = self.item_lookup_by_display_name[key][name]

        end = time.time()
        print(f"--Time elapsed to find matches: {end - start}")

        return matches

    def find_pattern_match(self, text):
        start = time.time()

        match = None
        for key, pattern in self.patterns.items():
            result = pattern["compiled_pattern"].parse(text)
            if result:
                # If the captured data points is an array of one thing, flatten in.
                data_points = result.fixed
                if type(data_points) == tuple and len(data_points) == 1:
                    data_points = data_points[0]

                match = {
                    "property_id": pattern["identifiers"][0],
                    "property_values": data_points
                }

                break

        end = time.time()
        print(f"--Time elapsed to find matches: {end - start}")

        return match

    def parse_item(self, item):
        parsed_item = {}

        start = time.time()

        # The first line is usually the item name
        parsed_item["display_name"] = item[0]

        # The second line is usually the type. Map it to be sure, (for now just setting to base_type)
        parsed_item["base_item"] = item[1]

        # Add matches from item data
        parsed_item["item_data_matches"] = self.find_item_by_display_name(parsed_item["display_name"]) | self.find_item_by_display_name(parsed_item["base_item"])

        # The next few lines help us determine
        for line in item:
            match = self.find_pattern_match(line)
            if match:
                # Store the property values
                if match["property_id"] not in parsed_item:
                    parsed_item[match["property_id"]] = []
                parsed_item[match["property_id"]].append(match["property_values"])

        end = time.time()
        print(f"-Time elapsed to parse an item: {end - start}")

        return parsed_item

    def parse_all_items(self):
        parsed_items = []
        start = time.time()

        for item in self.items:
            parsed_item = self.parse_item(item)
            parsed_items.append(parsed_item)

        end = time.time()
        print(f"Time elapsed to parse all items: {end - start}")

        return parsed_items

if __name__ == "__main__":
    item_parser = ItemParser()
    parsed_items = item_parser.parse_all_items()
    print(json.dumps(parsed_items, sort_keys=True, indent=4))
