from html.parser import HTMLParser

class HTMLValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.self_closing = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
        self.ids = {}
        self.line = 0
        
    def getpos(self):
        return self.getpos()
        
    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        
        # Check for duplicate IDs
        if 'id' in attr_dict:
            id_val = attr_dict['id']
            if id_val in self.ids:
                self.errors.append(f"Duplicate ID '{id_val}' at line {self.lineno} (first at line {self.ids[id_val]})")
            else:
                self.ids[id_val] = self.lineno
        
        # Check img alt
        if tag == 'img' and 'alt' not in attr_dict:
            self.errors.append(f"Missing alt attribute on <img> at line {self.lineno}")
            
        # Check input labels
        if tag == 'input':
            input_type = attr_dict.get('type', 'text')
            if input_type not in ('hidden', 'submit', 'button', 'reset', 'image'):
                if 'id' in attr_dict:
                    # Will check for label in post-processing
                    pass
        
        if tag not in self.self_closing:
            self.stack.append((tag, self.lineno))
    
    def handle_endtag(self, tag):
        if tag in self.self_closing:
            return
            
        # Find matching start tag
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                self.stack = self.stack[:i]
                return
                
        self.errors.append(f"Unexpected closing </{tag}> at line {self.lineno}")
    
    def check_unclosed(self):
        for tag, line in reversed(self.stack):
            self.errors.append(f"Unclosed <{tag}> from line {line}")

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

validator = HTMLValidator()
try:
    validator.feed(content)
    validator.check_unclosed()
except Exception as e:
    validator.errors.append(f"Parse error: {e}")

if validator.errors:
    print("HTML ERRORS FOUND:")
    for err in validator.errors:
        print(f"  - {err}")
else:
    print("No structural HTML errors found")
