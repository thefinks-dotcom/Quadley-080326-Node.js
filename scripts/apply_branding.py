#!/usr/bin/env python3
"""
Script to add dynamic branding (useTenant) to all mobile screens
that have hardcoded #3b82f6.
"""
import re
import os

# Files that already have useTenant - skip them
ALREADY_DONE = {
    'AdminDashboardScreen.js', 'StudentViewScreen.js', 'HomeScreen.js',
    'LoginScreen.js', 'ForgotPasswordScreen.js', 'RegisterScreen.js',
}

# SuperAdmin screens that manage branding - keep defaults
SKIP_SUPERADMIN = {
    'TenantBrandingScreen.js',  # manages branding presets
    'SuperAdminDashboardScreen.js',
}

BASE = '/app/mobile/src/screens'

def get_import_path(filepath):
    """Determine relative import path to TenantContext based on directory depth."""
    rel = os.path.relpath(filepath, BASE)
    depth = rel.count(os.sep)
    # screens/admin/File.js -> ../../contexts
    # screens/student/File.js -> ../../contexts
    return '../' * (depth) + 'contexts/TenantContext'

def process_file(filepath):
    fname = os.path.basename(filepath)
    if fname in ALREADY_DONE or fname in SKIP_SUPERADMIN:
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Skip if no hardcoded blue
    if '#3b82f6' not in content and '#3B82F6' not in content:
        return False
    
    original = content
    import_path = get_import_path(filepath)
    
    # 1. Add useTenant import if not present
    if 'useTenant' not in content:
        # Find the last import line
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import ') or line.strip().startswith('from '):
                last_import_idx = i
            # Also handle multi-line imports
            if "} from '" in line or "} from \"" in line:
                last_import_idx = i
        
        # Insert import after last import
        import_line = f"import {{ useTenant }} from '{import_path}';"
        lines.insert(last_import_idx + 1, import_line)
        content = '\n'.join(lines)
    
    # 2. Add branding hook and primaryColor derivation inside component
    # Find the main export default function
    # Pattern: export default function SomeName(
    match = re.search(r'(export default function \w+\([^)]*\)\s*\{)', content)
    if not match:
        # Try: const SomeName = ... or function SomeName
        match = re.search(r'(export default function \w+\([^)]*\)\s*\{)', content)
    
    if match:
        func_start = match.end()
        # Check if branding/primaryColor already defined
        if 'const primaryColor' not in content and "branding?.primaryColor" not in content:
            insert_code = "\n  const { branding } = useTenant();\n  const primaryColor = branding?.primaryColor || '#3b82f6';\n"
            content = content[:func_start] + insert_code + content[func_start:]
    else:
        # Try arrow function pattern: const X = ({ ... }) => {
        match = re.search(r'((?:export\s+)?(?:const|let)\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)', content)
        if match:
            func_start = match.end()
            if 'const primaryColor' not in content and "branding?.primaryColor" not in content:
                insert_code = "\n  const { branding } = useTenant();\n  const primaryColor = branding?.primaryColor || '#3b82f6';\n"
                content = content[:func_start] + insert_code + content[func_start:]
    
    # 3. Replace '#3b82f6' with primaryColor in style contexts
    # But be careful: don't replace in comments or string definitions
    # Replace patterns like: color: '#3b82f6' -> color: primaryColor
    # And: backgroundColor: '#3b82f6' -> backgroundColor: primaryColor
    
    # Simple replacement for quoted occurrences used as values
    content = content.replace("'#3b82f6'", 'primaryColor')
    content = content.replace('"#3b82f6"', 'primaryColor')
    content = content.replace("'#3B82F6'", 'primaryColor')
    content = content.replace('"#3B82F6"', 'primaryColor')
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all screen files
updated = []
for root, dirs, files in os.walk(BASE):
    for fname in sorted(files):
        if not fname.endswith('.js'):
            continue
        filepath = os.path.join(root, fname)
        if process_file(filepath):
            updated.append(os.path.relpath(filepath, '/app/mobile/src'))

# Also handle navigation
nav_file = '/app/mobile/src/navigation/RootNavigator.js'
if os.path.exists(nav_file):
    with open(nav_file, 'r') as f:
        content = f.read()
    if '#3b82f6' in content:
        # For RootNavigator, this is just a loading indicator - use theme color
        content = content.replace("'#3b82f6'", "'#3b82f6'")  # keep as-is for loading spinner
        # Actually let's skip this one - it's a loading spinner before context is available

print(f"Updated {len(updated)} files:")
for f in updated:
    print(f"  - {f}")
