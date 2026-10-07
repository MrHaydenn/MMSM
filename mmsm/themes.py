"""Curated, complete dark palettes; operational status colors remain consistent."""
THEMES = {
 'forest': ['#a6ec80','#0b1010','#111918','#16211f','#0f1614','#24342c','#253b31','#e4ece8','#9db3a7'],
 'midnight': ['#82b5ff','#0c1221','#121d32','#1a2942','#0e1729','#263e60','#2c4160','#e8f0ff','#a4b8d7'],
 'amethyst': ['#c3a0ff','#15101e','#20192b','#2c233a','#1b1426','#3d2d50','#443253','#f2eafa','#baa9cc'],
 'ember': ['#ffb277','#19120f','#281c17','#35251e','#211712','#4a3023','#513629','#fff0e5','#ceb19e'],
 'slate': ['#acd9df','#111519','#1c2329','#28323a','#161c21','#36454e','#3e4d57','#edf3f5','#aebfc9'],
}

def css(theme):
    keys = ['accent','bg','panel','panel2','navbar','hover','line','text','muted']
    values = THEMES.get(theme, THEMES['forest'])
    return ':root{' + ';'.join('--'+k+':'+v for k,v in zip(keys,values)) + '}'
