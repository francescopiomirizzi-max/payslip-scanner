import os
import re

files = [
    r"c:\Users\Franc\OneDrive\Desktop\google studio ferie\components\WorkerDetailPage.tsx"
]

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add layout to specific tab motion divs
    content = re.sub(r'<motion\.div([^>]*?key=[\'"](?:input|calc|pivot|tfr|visore)[\'"][^>]*?)>', r'<motion.div layout\1>', content)
    
    # Add layout to collapsible flex-1 containers
    content = re.sub(r'<motion\.div([^>]*?className=[\'"][^\'"]*?flex-1[^\'"]*?[\'"][^>]*?)>', r'<motion.div layout\1>', content)
    
    # Clean up accidental double layouts
    content = content.replace('layout layout', 'layout')
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Layout animation updates complete.")
