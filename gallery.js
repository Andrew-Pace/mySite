// gallery.js - reads ?category=Name and loads images from images/Name/
(function(){
    function qs(name){
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    const category = qs('category') || 'Animals';
    const titleEl = document.getElementById('gallery-title');
    titleEl.textContent = category;

    const gallery = document.getElementById('gallery');

    // manifest - map category to files present in images folder.
    // This keeps page decoupled from server-side listing.
    const manifest = {
        Animals: [
            'images/Animals/DSC_5086.JPG',
            'images/Animals/DSC_5087.JPG',
            'images/Animals/DSC_5093.JPG',
            'images/Animals/DSC_5095.JPG'
        ],
        Birds: [
            'images/Birds/DSC_5150.JPG',
            'images/Birds/DSC_5151.JPG',
            'images/Birds/DSC_5154.JPG',
            'images/Birds/DSC_5155.JPG',
            'images/Birds/DSC_5156.JPG',
            'images/Birds/DSC_5157.JPG',
            'images/Birds/DSC_5158.JPG'
        ],
        Machines: [
            'images/Machines/DSC_5137.JPG'
        ],
        Things: [
            'images/Things/DSC_5064.JPG',
            'images/Things/DSC_5065.JPG',
            'images/Things/DSC_5066.JPG',
            'images/Things/DSC_5067.JPG',
            'images/Things/DSC_5068.JPG'
        ]
    };

    const files = manifest[category];
    if(!files){
        gallery.innerHTML = '<p>Category not found.</p>';
        return;
    }

    files.forEach(src => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        item.appendChild(img);
        gallery.appendChild(item);
    });
})();
