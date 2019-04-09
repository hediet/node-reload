import {
    installDiffingReconciler,
    reloadable
} from "../diffingReconciler";


//@reloadable.class()
/*class Test {
    constructor() {
        autorun(() => {
            this.run();
        });
    }

    @observable
    run = () => {
        console.log(this.sum.get());
    };

    @observable
    getItems = () => {
        return { a: 10, b: 100 };
    };

    @observable
    sum = computed(() => {
        const { a, b } = this.getItems();
        return a + b;
    });
}
*/
