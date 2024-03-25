(()=>{const e="toc-level-";class t{name;_className;link;_level;element;constructor(t,n){this.element=t,this.name=t.textContent,this._className=e+n,this.link="#"+t.id,this._level=n}isAboveWindow(){return this.element.offsetTop<document.documentElement.scrollTop+window.innerHeight/3}get className(){return this._className}get level(){return this._level}set level(t){this._className=e+t,this._level=t}}const n=Vue.defineComponent({name:"TopicItem",props:{item:t,visible:Boolean,index:Number},emits:{linkClick:Number},setup(e,{emit:t}){const n=()=>{t("linkClick",e.index)};return()=>h("div",{class:[e.visible?"toc-item-active":"toc-item-inactive","toc-item",e.item.className]},[h("a",{on:{click:n},attrs:{href:e.item.link}},[e.item.name])])}}),i=Vue.defineComponent({components:{TopicItem:n},name:"toc-component",setup(){const e=Vue.ref([]),i=Vue.ref(1),o=Vue.ref("0");let l;function s(){if(l)return;let t;for(t=e.value.length-1;t>=0;t--){if(e.value[t].isAboveWindow()){i.value=t;break}}-1===t&&(i.value=0)}function a(){c()}Vue.onMounted((()=>{const n=document.getElementById("main-content");if(!n)return;const o=[],l=n.childNodes;let m=1e3;if(l.forEach((e=>{let n;2!==e.nodeName.length||"H"!==e.nodeName[0]||Number.isNaN(n=Number.parseInt(e.nodeName[1]))||(o.push(new t(e,n)),m=Math.min(m,n))})),e.value=o,m>1){const e=m-1;o.forEach((t=>{t.level-=e}))}window.addEventListener("scroll",s),window.addEventListener("resize",a),s(),c(),setTimeout((()=>{c(),i.value=0}),1200)})),Vue.onUnmounted((()=>{window.removeEventListener("scroll",s),window.removeEventListener("resize",a)}));const c=()=>{const{clientWidth:e}=document.documentElement;o.value=(e-900)/2+"px"},m=e=>{l=!0,i.value=e,setTimeout((()=>{l=!1}),50)};return()=>h("div",{attrs:{id:"toc"},style:{top:"50%",transform:"translateY(-50%)",maxHeight:"80%",width:o.value}},[h("div",{class:"toc-scroll"},[e.value.length>0?h("div",{class:"toc-header",style:{backgroundColor:"#f6f8fa"}},["目录"]):null,e.value.map(((e,t)=>h(n,{key:e.name,attrs:{item:e,visible:i.value===t,index:t},on:{linkClick:m}})))])])}});mixins.toc={components:{"toc-component":i}}})();